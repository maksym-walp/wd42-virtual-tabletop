import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Trash2 } from 'lucide-react';
import characterApi from '../api/characterSheet';
import { ARCHETYPES, RACES, ARCHETYPE_COLORS } from '../constants/characterSheet';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';

export default function CharacterList() {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    characterApi.list()
      .then(setCharacters)
      .catch(() => setError('Не вдалось завантажити персонажів'))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id, name) => {
    if (!confirm(`Видалити персонажа "${name}"? Це незворотно.`)) return;
    try {
      await characterApi.remove(id);
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
            {c.race_ancestry ? ` (${RACES[c.race_ancestry]?.label ?? c.race_ancestry})` : ''}
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

function Stat({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.7rem] uppercase tracking-wide text-text-dim">{label}</span>
      <span className="font-semibold text-gold">{value}</span>
    </div>
  );
}
