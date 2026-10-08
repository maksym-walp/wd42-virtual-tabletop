import { useEffect, useState } from 'react';
import { Trash2, Lock, Plus } from 'lucide-react';
import campaignApi from '../../api/campaigns';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Field, { inputClass } from '../ui/Field';
import EmptyState from '../ui/EmptyState';
import Sheet from '../ui/Sheet';
import SmartTextarea from '../ui/SmartTextarea';
import SmartTextReader from '../SmartTextReader';
import { ARCHETYPES, RACES } from '../../constants/characterSheet';

// ================================================================
// Головна: назва й опис, попередні сесії, картки персонажів.
// sessionsVersion змінюється на real-time подію 'sessions' — тоді список
// сесій перезапитується.
// ================================================================

export default function HomeTab({ campaign, characters, isGm, navigate, sessionsVersion }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <CampaignAbout campaign={campaign} />
        <Card>
          <SessionsPanel campaignId={campaign.id} isGm={isGm} version={sessionsVersion} />
        </Card>
      </div>
      <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <CharactersBlock characters={characters} navigate={navigate} />
      </aside>
    </div>
  );
}

function CampaignAbout({ campaign }) {
  return (
    <Card>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Майстер</p>
      <p className="mb-4 text-sm text-text">{campaign.gm_username}</p>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Опис кампанії</p>
      {campaign.description ? (
        <SmartTextReader text={campaign.description} className="text-sm text-text" />
      ) : (
        <p className="text-sm text-text-dim">Опису ще немає.</p>
      )}
    </Card>
  );
}

function SessionsPanel({ campaignId, isGm, version }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheetSession, setSheetSession] = useState(null); // null=closed, {}=нова, {...}=перегляд/редагування

  useEffect(() => {
    let alive = true;
    campaignApi.listSessions(campaignId)
      .then((rows) => { if (alive) setSessions(rows); })
      .catch(() => { if (alive) setError('Не вдалось завантажити сесії'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [campaignId, version]);

  const refresh = () => campaignApi.listSessions(campaignId).then(setSessions);

  const handleDeleted = (sessionId) => {
    setSheetSession(null);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="m-0 font-display text-base text-text">Попередні сесії</h3>
        {isGm && (
          <button
            type="button"
            onClick={() => setSheetSession({})}
            aria-label="Додати сесію"
            className="p-1 text-text-dim hover:text-accent"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-text-dim">Завантаження...</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-text-dim">
          {isGm ? 'Додайте запис про минулу сесію.' : 'Майстер ще не додав записів про сесії.'}
        </p>
      ) : (
        <ul className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSheetSession(s)}
                className="w-full rounded-lg border border-border px-3 py-2 text-left hover:border-accent/50"
              >
                <p className="truncate text-sm text-text">{s.title}</p>
                {s.session_date && <p className="text-xs text-text-dim">{s.session_date}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <SessionSheet
        session={sheetSession}
        isGm={isGm}
        campaignId={campaignId}
        onClose={() => setSheetSession(null)}
        onSaved={() => { setSheetSession(null); refresh(); }}
        onDeleted={handleDeleted}
      />
    </div>
  );
}

function SessionSheet({ session, isGm, campaignId, onClose, onSaved, onDeleted }) {
  const isNew = !!session && !session.id;
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    setTitle(session.title ?? '');
    setContent(session.content ?? '');
    setDate(session.session_date ? String(session.session_date).slice(0, 10) : '');
    setError('');
  }, [session]);

  if (!session) return null;

  const handleSave = async () => {
    if (!title.trim()) { setError('Вкажіть назву сесії'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { title: title.trim(), content, session_date: date || null };
      if (isNew) await campaignApi.addSession(campaignId, payload);
      else await campaignApi.updateSession(campaignId, session.id, payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при збереженні сесії');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Видалити запис "${session.title}"?`)) return;
    try {
      await campaignApi.removeSession(campaignId, session.id);
      onDeleted(session.id);
    } catch {
      setError('Не вдалось видалити сесію');
    }
  };

  return (
    <Sheet open onClose={onClose} title={isNew ? 'Нова сесія' : (isGm ? 'Редагувати сесію' : session.title)}>
      {isGm ? (
        <div className="flex flex-col gap-4">
          <Field label="Назва">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </Field>
          <Field label="Дата сесії (необовʼязково)">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <SmartTextarea label="Опис / нотатки" rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            {!isNew && (
              <Button variant="danger" size="sm" onClick={handleDelete}>
                <Trash2 size={14} /> Видалити
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving} className="ml-auto">
              {saving ? 'Збереження...' : 'Зберегти'}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          {session.session_date && <p className="mb-2 text-xs text-text-dim">{session.session_date}</p>}
          {session.content ? (
            <SmartTextReader text={session.content} className="text-sm text-text" />
          ) : (
            <p className="text-sm text-text-dim">Без опису.</p>
          )}
        </div>
      )}
    </Sheet>
  );
}

function CharactersBlock({ characters, navigate }) {
  return (
    <div>
      <h3 className="mb-2 font-display text-base text-text">Персонажі кампанії</h3>
      {characters.length === 0 ? (
        <EmptyState title="До кампанії ще не приєднано жодного персонажа" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {characters.map((ch) => {
            const clickable = !ch.is_private;
            return (
              <Card
                key={ch.character_id}
                className={clickable ? 'cursor-pointer hover:border-accent/50' : 'opacity-80'}
                onClick={clickable ? () => navigate(`/characters/${ch.character_id}`) : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base text-text">{ch.character_name}</h3>
                  {ch.is_private && <Lock size={14} className="mt-1 shrink-0 text-text-dim" aria-label="Приватний персонаж" />}
                </div>
                <p className="text-sm text-text-dim">{ARCHETYPES[ch.archetype]?.label ?? ch.archetype} · {RACES[ch.race]?.label ?? ch.race}</p>
                <p className="mt-2 text-xs text-text-dim">
                  Гравець: {ch.owner_username} {ch.is_mine && <span className="text-accent">(ви)</span>}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
