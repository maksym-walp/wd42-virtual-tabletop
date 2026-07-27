import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Trash2 } from 'lucide-react';
import characterApi from '../api/characterSheet';
import campaignApi from '../api/campaigns';
import { removeView } from '../utils/recentlyViewed';
import { ARCHETYPES, RACES, ARCHETYPE_COLORS as ARCHETYPE_COLORS_LIGHT, ARCHETYPE_COLORS_DARK } from '../constants/characterSheet';
import { useTheme } from '../context/ThemeContext';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';

export default function CharacterList() {
  const [characters, setCharacters] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    characterApi.list()
      .then(setCharacters)
      .catch(() => setError('Не вдалось завантажити персонажів'))
      .finally(() => setLoading(false));
    campaignApi.list().then(setCampaigns).catch(() => {});
  }, []);

  const handleDelete = async (id, name) => {
    if (!confirm(`Видалити персонажа "${name}"? Це незворотно.`)) return;
    try {
      await characterApi.remove(id);
      removeView('character', id);
      setCharacters((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert('Помилка при видаленні');
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <PageHeader
        title="⚔ Мої персонажі"
        action={<Button to="/characters/new">+ Новий персонаж</Button>}
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {campaigns.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Кампанії</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {campaigns.map((c) => <CampaignRowCard key={c.id} campaign={c} />)}
          </div>
        </div>
      )}

      {characters.length === 0 ? (
        <EmptyState title="У вас ще немає персонажів" action={<Button to="/characters/new">Створити першого</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((c) => (
            <CharacterCard
              key={c.id}
              character={c}
              onDelete={() => handleDelete(c.id, c.name)}
              onClick={() => navigate(`/characters/${c.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CharacterCard({ character: c, onDelete, onClick }) {
  const { theme } = useTheme();
  const ARCHETYPE_COLORS = theme === 'dark' ? ARCHETYPE_COLORS_DARK : ARCHETYPE_COLORS_LIGHT;
  const archetype = ARCHETYPES[c.archetype];
  const race = RACES[c.race];
  const archetypeColor = ARCHETYPE_COLORS[c.archetype];

  return (
    <Card onClick={onClick} className="cursor-pointer hover:border-accent/50">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-text">{c.name}</h2>
          <p className="text-sm text-text-dim">
            {archetype?.label} · {race?.label}
          </p>
        </div>
        {archetypeColor && (
          <Badge color={archetypeColor.color} bg={archetypeColor.bg} className="shrink-0">
            {archetype?.label}
          </Badge>
        )}
      </div>

      <div className="mb-4 flex gap-5">
        <Stat label="ПЗ" value={c.current_hp} />
        <Stat label="Магія" value={c.current_magic} />
        <Stat label="Публічний" value={c.is_public ? 'Так' : 'Ні'} />
      </div>

      <div
        className="flex flex-wrap items-center gap-4 border-t border-border pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <Link to={`/characters/${c.id}`} className="text-sm text-accent">Відкрити лист</Link>
        {c.is_public && (
          <a
            href={`/characters/public/${c.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-accent"
          >
            Публічне <ExternalLink size={13} />
          </a>
        )}
        <button
          onClick={onDelete}
          className="ml-auto inline-flex items-center gap-1 p-1 text-sm text-danger"
          aria-label="Видалити персонажа"
        >
          <Trash2 size={15} /> Видалити
        </button>
      </div>
    </Card>
  );
}

function CampaignRowCard({ campaign: c }) {
  return (
    <Link
      to={`/campaigns/${c.id}`}
      className="block w-56 shrink-0 overflow-hidden rounded-lg border border-border bg-surface"
      style={{ borderLeft: '4px solid var(--color-accent)' }}
    >
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <h3 className="font-display text-lg text-accent">{c.name}</h3>
        <Badge color={c.is_gm ? '#1a1a1a' : undefined} bg={c.is_gm ? '#d4af37' : undefined}
          className={`shrink-0 ${c.is_gm ? '' : 'border border-border text-text-dim'}`}>
          {c.is_gm ? 'Майстер' : 'Гравець'}
        </Badge>
      </div>
    </Link>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.7rem] uppercase tracking-wide text-text-dim">{label}</span>
      <span className="font-semibold text-gold">{value}</span>
    </div>
  );
}
