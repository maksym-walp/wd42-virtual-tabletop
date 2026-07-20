import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Gem, BookOpen, Star, Zap, Swords, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import characterApi from '../api/characterSheet';
import diceApi from '../api/dice';
import { getRecentlyViewed } from '../utils/recentlyViewed';
import { ARCHETYPES, RACES } from '../constants/characterSheet';
import ArtifactCard from '../components/ArtifactCard';
import SpellCard from '../components/SpellCard';
import AbilityCard from '../components/AbilityCard';
import ManeuverCard from '../components/ManeuverCard';
import DiceStatsGrid from '../components/DiceStatsGrid';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';

const RECENT_TYPE_META = {
  artifact:  { label: 'Артефакт',    icon: Gem },
  spell:     { label: 'Заклинання',  icon: BookOpen },
  ability:   { label: 'Вміння',      icon: Star },
  maneuver:  { label: 'Маневр',      icon: Zap },
  equipment: { label: 'Спорядження', icon: Swords },
  character: { label: 'Персонаж',    icon: Users },
};

const COMMUNITY_LIMIT = 12;

export default function Dashboard() {
  const { user } = useAuth();
  const [recent, setRecent] = useState([]);
  const [communityCharacters, setCommunityCharacters] = useState([]);
  const [communityArtifacts, setCommunityArtifacts] = useState([]);
  const [communitySpells, setCommunitySpells] = useState([]);
  const [communityAbilities, setCommunityAbilities] = useState([]);
  const [communityManeuvers, setCommunityManeuvers] = useState([]);
  const [diceStats, setDiceStats] = useState(null);

  useEffect(() => {
    setRecent(getRecentlyViewed());
  }, []);

  useEffect(() => {
    characterApi.listCommunity({ limit: COMMUNITY_LIMIT }).then(setCommunityCharacters).catch(() => {});
    api.get(`/api/artifacts/?scope=community&limit=${COMMUNITY_LIMIT}`)
      .then(({ data }) => setCommunityArtifacts(data.artifacts ?? [])).catch(() => {});
    api.get(`/api/spellbook/?scope=community&limit=${COMMUNITY_LIMIT}`)
      .then(({ data }) => setCommunitySpells(data.spells ?? [])).catch(() => {});
    api.get('/api/abilities/?scope=community&limit=8')
      .then(({ data }) => setCommunityAbilities(data.abilities ?? [])).catch(() => {});
    api.get('/api/maneuvers/?scope=community&limit=8')
      .then(({ data }) => setCommunityManeuvers(data.maneuvers ?? [])).catch(() => {});
    diceApi.stats().then(setDiceStats).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <PageHeader title={`Вітаємо, ${user.username}!`} subtitle="Що нового у світі Walp" />

      <Section title="Останні переглянуті">
        {recent.map((entry) => <RecentViewCard key={`${entry.type}-${entry.id}`} entry={entry} />)}
      </Section>

      <Section title="Творіння спільноти · Персонажі">
        {communityCharacters.map((c) => <CommunityCharacterCard key={c.id} character={c} />)}
      </Section>

      <Section title="Творіння спільноти · Артефакти">
        {communityArtifacts.map((a) => (
          <div key={a.id} className="w-56 shrink-0"><ArtifactCard artifact={a} /></div>
        ))}
      </Section>

      <Section title="Творіння спільноти · Заклинання">
        {communitySpells.map((s) => (
          <div key={s.id} className="w-56 shrink-0"><SpellCard spell={s} /></div>
        ))}
      </Section>

      <Section title="Творіння спільноти · Вміння та Маневри">
        {[
          ...communityAbilities.map((a) => (
            <div key={`ability-${a.id}`} className="w-56 shrink-0"><AbilityCard ability={a} /></div>
          )),
          ...communityManeuvers.map((m) => (
            <div key={`maneuver-${m.id}`} className="w-56 shrink-0"><ManeuverCard maneuver={m} /></div>
          )),
        ]}
      </Section>

      {diceStats && diceStats.total_rolls > 0 && (
        <Card>
          <h2 className="mb-4 font-display text-lg text-text">Статистика кидків</h2>
          <DiceStatsGrid diceStats={diceStats} />
        </Card>
      )}
    </div>
  );
}

// Collapsible horizontal-scroll rail. Hides itself once its items list is
// empty — same "don't show empty sections" rule CollectionsRow uses.
function Section({ title, children }) {
  const [open, setOpen] = useState(true);
  const items = Array.isArray(children) ? children : [children];
  if (items.filter(Boolean).length === 0) return null;

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-2 flex w-full items-center justify-between gap-2 text-left"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-dim">{title}</h2>
        <ChevronDown size={16} className={`text-text-dim transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="flex gap-4 overflow-x-auto pb-2">{items}</div>}
    </div>
  );
}

function RecentViewCard({ entry }) {
  const meta = RECENT_TYPE_META[entry.type];
  const Icon = meta?.icon ?? Gem;
  return (
    <Link
      to={entry.href}
      className="block w-40 shrink-0 overflow-hidden rounded-lg border border-border bg-surface sm:w-48"
    >
      {entry.image_url ? (
        <div className="aspect-[4/3] w-full overflow-hidden bg-bg">
          <img src={entry.image_url} alt={entry.name} className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-bg text-accent">
          <Icon size={28} strokeWidth={1.5} />
        </div>
      )}
      <div className="px-3 py-2">
        <span className="text-[0.65rem] uppercase tracking-wide text-text-dim">{meta?.label}</span>
        <h3 className="truncate font-display text-sm text-accent">{entry.name}</h3>
      </div>
    </Link>
  );
}

function CommunityCharacterCard({ character: c }) {
  const archetype = ARCHETYPES[c.archetype];
  const race = RACES[c.race];
  return (
    <Link
      to={`/characters/${c.id}`}
      className="block w-56 shrink-0 overflow-hidden rounded-lg border border-border bg-surface"
      style={{ borderLeft: '4px solid var(--color-accent)' }}
    >
      {c.image_url && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-bg">
          <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="px-3.5 py-2.5">
        <h3 className="font-display text-lg text-accent">{c.name}</h3>
        <p className="text-sm text-text-dim">{archetype?.label} · {race?.label}</p>
        {c.owner_username && <p className="mt-1 text-xs italic text-text-dim">@{c.owner_username}</p>}
      </div>
    </Link>
  );
}
