import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Trash2, Check, X as XIcon } from 'lucide-react';
import campaignApi from '../api/campaigns';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Field, { inputClass } from '../components/ui/Field';
import EmptyState from '../components/ui/EmptyState';

function useDebounce(fn, delay = 600) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

const TABS = [
  { key: 'characters', label: 'Персонажі' },
  { key: 'notes', label: 'Нотатки' },
];

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('characters');

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([campaignApi.getOne(id), campaignApi.listCharacters(id)])
      .then(([c, chars]) => { setCampaign(c); setCharacters(chars); })
      .catch(() => setError('Не вдалось завантажити кампанію'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (error || !campaign) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="mb-4 text-danger">{error || 'Кампанію не знайдено'}</p>
        <Link to="/campaigns" className="text-sm text-accent">← До списку кампаній</Link>
      </div>
    );
  }

  const isGm = campaign.is_gm;

  const startRename = () => {
    setNameDraft(campaign.name);
    setEditingName(true);
  };

  const cancelRename = () => {
    setEditingName(false);
    setNameDraft('');
  };

  const saveRename = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === campaign.name) { cancelRename(); return; }
    setRenaming(true);
    try {
      const updated = await campaignApi.rename(campaign.id, trimmed);
      setCampaign((prev) => ({ ...prev, name: updated.name }));
      setEditingName(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при перейменуванні');
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!confirm(`Видалити кампанію "${campaign.name}"? Персонажі гравців не видаляться, лише відв'яжуться від кампанії. Це незворотно.`)) return;
    setDeleting(true);
    try {
      await campaignApi.remove(campaign.id);
      navigate('/campaigns');
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при видаленні кампанії');
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[900px] px-4 pt-6 pb-28 sm:px-6 md:pb-16">
      <div className="mb-4">
        <Link to="/campaigns" className="text-sm text-accent">← Кампанії</Link>
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className={`${inputClass} font-display text-lg`}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveRename();
                  if (e.key === 'Escape') cancelRename();
                }}
                maxLength={200}
              />
              <button onClick={saveRename} disabled={renaming} aria-label="Зберегти назву" className="p-1.5 text-sage">
                <Check size={20} />
              </button>
              <button onClick={cancelRename} disabled={renaming} aria-label="Скасувати" className="p-1.5 text-text-dim">
                <XIcon size={20} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="m-0 font-display text-3xl font-bold text-text">{campaign.name}</h1>
              {isGm && (
                <button onClick={startRename} aria-label="Перейменувати кампанію" className="p-1 text-text-dim hover:text-accent">
                  <Pencil size={16} />
                </button>
              )}
            </div>
          )}
          {isGm && (
            <p className="mt-1 text-sm text-text-dim">
              Код запрошення: <span className="font-mono text-gold">{campaign.invite_code}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge bg={isGm ? '#d4af37' : undefined} color={isGm ? '#1a1a1a' : undefined}
            className={isGm ? '' : 'border border-border text-text-dim'}>
            {isGm ? 'Майстер' : 'Гравець'}
          </Badge>
          {isGm && (
            <Button variant="danger" size="sm" onClick={handleDeleteCampaign} disabled={deleting}>
              <Trash2 size={14} /> {deleting ? 'Видалення...' : 'Видалити кампанію'}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button key={t.key}
            className={`rounded-t-lg border border-b-0 px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.key ? 'border-gold/60 bg-gold/10 text-gold' : 'border-transparent text-text-dim'
            }`}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'characters' && (
        <CharactersTab
          campaignId={campaign.id}
          characters={characters}
          setCharacters={setCharacters}
          isGm={isGm}
          navigate={navigate}
        />
      )}
      {tab === 'notes' && (
        <NotesTab campaign={campaign} isGm={isGm} onChange={setCampaign} />
      )}
    </div>
  );
}

function CharactersTab({ campaignId, characters, setCharacters, isGm, navigate }) {
  const [newCharacterId, setNewCharacterId] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const refresh = () => campaignApi.listCharacters(campaignId).then(setCharacters);

  const handleRemove = async (characterId, characterName) => {
    if (!confirm(`Видалити персонажа "${characterName}" з кампанії? Сам лист персонажа не буде видалено.`)) return;
    try {
      await campaignApi.removeCharacter(campaignId, characterId);
      setCharacters((prev) => prev.filter((c) => c.character_id !== characterId));
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при видаленні персонажа з кампанії');
    }
  };

  const handleAdd = async () => {
    if (!newCharacterId.trim()) return;
    setAdding(true);
    setError('');
    try {
      await campaignApi.addCharacter(campaignId, newCharacterId.trim());
      setNewCharacterId('');
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при додаванні персонажа');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {isGm && (
        <Card>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Додати персонажа за ID
          </p>
          <div className="flex gap-2">
            <input
              className={`${inputClass} flex-1`}
              value={newCharacterId}
              onChange={(e) => setNewCharacterId(e.target.value)}
              placeholder="ID персонажа, який надав гравець"
            />
            <Button onClick={handleAdd} disabled={adding} size="md">
              {adding ? 'Додавання...' : 'Додати'}
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </Card>
      )}

      {characters.length === 0 ? (
        <EmptyState title="До кампанії ще не приєднано жодного персонажа" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {characters.map((ch) => {
            const isMine = ch.is_mine;
            // GM can open (and edit) any character in the campaign, not just their own
            const clickable = isMine || isGm;
            return (
              <Card
                key={ch.character_id}
                className={clickable ? 'cursor-pointer hover:border-accent/50' : ''}
                onClick={clickable ? () => navigate(`/characters/${ch.character_id}`) : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base text-text">{ch.character_name}</h3>
                  {isGm && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemove(ch.character_id, ch.character_name); }}
                      aria-label="Видалити персонажа з кампанії"
                      className="shrink-0 p-1 text-text-dim hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <p className="text-sm text-text-dim">{ch.archetype} · {ch.race}</p>
                <p className="mt-2 text-xs text-text-dim">
                  Власник: {ch.owner_username} {isMine && <span className="text-accent">(ви)</span>}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotesTab({ campaign, isGm, onChange }) {
  const [sharedNotes, setSharedNotes] = useState(campaign.shared_notes ?? '');
  const [gmNotes, setGmNotes] = useState(campaign.gm_notes ?? '');
  const [saving, setSaving] = useState(false);

  const saveShared = useDebounce(async (value) => {
    setSaving(true);
    try {
      const updated = await campaignApi.updateSharedNotes(campaign.id, value);
      onChange((prev) => ({ ...prev, shared_notes: updated.shared_notes }));
    } finally {
      setSaving(false);
    }
  });

  const saveGm = useDebounce(async (value) => {
    setSaving(true);
    try {
      const updated = await campaignApi.updateGmNotes(campaign.id, value);
      onChange((prev) => ({ ...prev, gm_notes: updated.gm_notes }));
    } finally {
      setSaving(false);
    }
  });

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_1fr]">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs text-text-dim">Спільні нотатки</label>
          {saving && <span className="text-xs text-text-dim">• Збереження...</span>}
        </div>
        <textarea
          className={`${inputClass} w-full resize-y`}
          rows={12}
          value={sharedNotes}
          onChange={(e) => { setSharedNotes(e.target.value); if (isGm) saveShared(e.target.value); }}
          placeholder="Нотатки, які бачать усі учасники кампанії..."
          disabled={!isGm}
        />
      </div>
      {isGm && (
        <div>
          <label className="mb-1 block text-xs text-text-dim">Нотатки майстра (лише для вас)</label>
          <textarea
            className={`${inputClass} w-full resize-y`}
            rows={12}
            value={gmNotes}
            onChange={(e) => { setGmNotes(e.target.value); saveGm(e.target.value); }}
            placeholder="Секретні нотатки, плани, сюжетні твісти..."
          />
        </div>
      )}
    </div>
  );
}
