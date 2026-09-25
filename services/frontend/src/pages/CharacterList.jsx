import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Trash2, Copy } from 'lucide-react';
import characterApi from '../api/characterSheet';
import campaignApi from '../api/campaigns';
import { removeView } from '../utils/recentlyViewed';
import { ARCHETYPES, RACES, ARCHETYPE_COLORS as ARCHETYPE_COLORS_LIGHT, ARCHETYPE_COLORS_DARK } from '../constants/characterSheet';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Sheet from '../components/ui/Sheet';
import { inputClass } from '../components/ui/Field';
import ChangeOwnerControl from '../components/ChangeOwnerControl';

export default function CharacterList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [characters, setCharacters] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [duplicating, setDuplicating] = useState(null);
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

  const handleSetOwner = async (charId, ownerUsername) => {
    const updated = await characterApi.setOwner(charId, ownerUsername);
    setCharacters((prev) => prev.map((c) => (c.id === charId ? { ...c, ...updated } : c)));
  };

  const handleDuplicated = (newChar) => {
    setDuplicating(null);
    navigate(`/characters/${newChar.id}`);
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
              isAdmin={isAdmin}
              onDelete={() => handleDelete(c.id, c.name)}
              onDuplicate={() => setDuplicating(c)}
              onSetOwner={(username) => handleSetOwner(c.id, username)}
              onClick={() => navigate(`/characters/${c.id}`)}
            />
          ))}
        </div>
      )}

      <DuplicateCharacterSheet
        character={duplicating}
        open={Boolean(duplicating)}
        onClose={() => setDuplicating(null)}
        onDuplicated={handleDuplicated}
      />
    </div>
  );
}

function DuplicateCharacterSheet({ character, open, onClose, onDuplicated }) {
  const [name, setName] = useState('');
  const [archetype, setArchetype] = useState('');
  const [race, setRace] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!character) return;
    setName(`${character.name} (копія)`);
    setArchetype(character.archetype);
    setRace(character.race);
    setError('');
  }, [character]);

  if (!character) return null;

  const archetypeChanged = archetype !== character.archetype;

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const created = await characterApi.duplicate(character.id, { name, archetype, race });
      onDuplicated(created);
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалося задублювати персонажа');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Дублювати персонажа">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm text-text-dim">
          Ім'я дубля
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-text-dim">
          Архетип
          <select className={inputClass} value={archetype} onChange={(e) => setArchetype(e.target.value)}>
            {Object.entries(ARCHETYPES).map(([key, a]) => <option key={key} value={key}>{a.label}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-text-dim">
          Народ
          <select className={inputClass} value={race} onChange={(e) => setRace(e.target.value)}>
            {Object.entries(RACES).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
          </select>
        </label>

        {archetypeChanged && (
          <p className="rounded-md border border-gold/50 bg-gold/10 px-3 py-2 text-xs text-text-dim">
            Архетип змінюється — прогрес дерева розвитку, вміння, закляття та ритуали з дерева
            в дублі перенесені НЕ будуть.
          </p>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Скасувати</Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? 'Дублювання...' : 'Дублювати'}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function CharacterCard({ character: c, isAdmin, onDelete, onDuplicate, onSetOwner, onClick }) {
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
          {isAdmin && c.owner_username && (
            <p className="text-xs italic text-text-dim">@{c.owner_username}</p>
          )}
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
          onClick={onDuplicate}
          className="ml-auto inline-flex items-center gap-1 p-1 text-sm text-text-dim hover:text-accent"
          aria-label="Дублювати персонажа"
        >
          <Copy size={15} /> Дублювати
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1 p-1 text-sm text-danger"
          aria-label="Видалити персонажа"
        >
          <Trash2 size={15} /> Видалити
        </button>
      </div>

      {isAdmin && (
        <div className="border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
          <ChangeOwnerControl onSubmit={onSetOwner} />
        </div>
      )}
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
        <Badge className={`shrink-0 ${c.is_gm ? 'bg-gold text-bg' : 'border border-border text-text-dim'}`}>
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
