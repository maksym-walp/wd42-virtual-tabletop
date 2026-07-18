import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import profileApi from '../api/profile';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import SpellCard from '../components/SpellCard';
import AbilityCard from '../components/AbilityCard';
import ManeuverCard from '../components/ManeuverCard';
import EquipmentCard from '../components/EquipmentCard';
import { ARCHETYPES, ARCHETYPE_COLORS, RACES } from '../constants/characterSheet';

const COLLECTION_LABELS = {
  equipment: 'Спорядження',
  spellbook: 'Заклинання',
  abilities: 'Вміння',
  maneuvers: 'Маневри',
};

export default function PublicProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('characters');

  useEffect(() => {
    setLoading(true);
    setError('');
    profileApi.getPublicProfile(username)
      .then((data) => {
        setProfile(data);
        // Land on the first non-empty section for a friendlier first view.
        const first = SECTIONS.find((s) => (data[s.key] ?? []).length > 0);
        setTab(first ? first.key : 'characters');
      })
      .catch((err) => {
        setError(err.response?.status === 404
          ? 'Користувача не знайдено'
          : 'Не вдалося завантажити профіль');
      })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return <p className="py-12 text-center text-text-dim">Завантаження...</p>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <EmptyState title={error} />
      </div>
    );
  }

  const total = SECTIONS.reduce((n, s) => n + (profile[s.key]?.length ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <PageHeader
        title={`@${profile.username}`}
        subtitle={`Публічний профіль · ${total} записів`}
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => {
          const count = profile[s.key]?.length ?? 0;
          return (
            <button
              key={s.key}
              onClick={() => setTab(s.key)}
              className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
                tab === s.key
                  ? 'border-accent/60 bg-accent/10 text-accent'
                  : 'border-border text-text-dim hover:text-text'
              }`}
            >
              {s.label} <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <Section items={profile[tab]} tab={tab} />
    </div>
  );
}

function Section({ items, tab }) {
  if (!items || items.length === 0) {
    return <EmptyState title="Тут поки порожньо" />;
  }

  if (tab === 'characters') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => <PublicCharacterCard key={c.id} character={c} />)}
      </div>
    );
  }

  if (tab === 'collections') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((col) => <PublicCollectionCard key={`${col.domain}-${col.id}`} collection={col} />)}
      </div>
    );
  }

  const CardComponent = {
    equipment: (i) => <EquipmentCard key={i.id} item={i} />,
    spells:    (i) => <SpellCard key={i.id} spell={i} />,
    abilities: (i) => <AbilityCard key={i.id} ability={i} />,
    maneuvers: (i) => <ManeuverCard key={i.id} maneuver={i} />,
  }[tab];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((i) => CardComponent(i))}
    </div>
  );
}

function PublicCharacterCard({ character: c }) {
  const archetype = ARCHETYPES[c.archetype];
  const race = RACES[c.race];
  const archetypeColor = ARCHETYPE_COLORS[c.archetype];
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-text">{c.name}</h2>
          <p className="mt-0.5 text-sm text-text-dim">
            {archetype?.label} · {race?.label}
            {c.race_ancestry ? ` (${RACES[c.race_ancestry]?.label ?? c.race_ancestry})` : ''}
          </p>
        </div>
        {archetypeColor && (
          <Badge color={archetypeColor.color} bg={archetypeColor.bg} className="shrink-0">
            {archetype?.label}
          </Badge>
        )}
      </div>
      <Link to={`/characters/public/${c.id}`} className="mt-auto inline-flex items-center gap-1 text-sm text-accent">
        Переглянути лист <ExternalLink size={13} />
      </Link>
    </Card>
  );
}

function PublicCollectionCard({ collection: col }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-lg text-text">{col.name}</h2>
        <Badge className="shrink-0 border border-border text-text-dim">{COLLECTION_LABELS[col.domain] ?? col.domain}</Badge>
      </div>
      {col.description && <p className="text-sm text-text-dim line-clamp-3">{col.description}</p>}
      <Link
        to={`/${col.domain}/collections/public/${col.id}`}
        className="mt-auto inline-flex items-center gap-1 text-sm text-accent"
      >
        Відкрити колекцію <ExternalLink size={13} />
      </Link>
    </Card>
  );
}

const SECTIONS = [
  { key: 'characters',  label: 'Персонажі' },
  { key: 'equipment',   label: 'Спорядження' },
  { key: 'spells',      label: 'Заклинання' },
  { key: 'abilities',   label: 'Вміння' },
  { key: 'maneuvers',   label: 'Маневри' },
  { key: 'collections', label: 'Колекції' },
];
