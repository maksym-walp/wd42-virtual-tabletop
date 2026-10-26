import { useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import campaignApi from '../../api/campaigns';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Field, { inputClass } from '../ui/Field';
import Sheet from '../ui/Sheet';
import SmartTextarea from '../ui/SmartTextarea';
import SmartTextReader from '../SmartTextReader';

// ================================================================
// Попередні сесії: записи майстра про минулі сесії. Живуть під календарем
// на Столі; version змінюється на real-time подію 'sessions' — тоді список
// перезапитується. Локації, події й НІПи — ті самі rich-text поля, що й опис:
// у них вставляються посилання-чипи на записи сайту.
// ================================================================

// session_date приходить як ISO-рядок (DATE → UTC-північ); показуємо лише день.
const formatDate = (value) => {
  const [y, m, d] = String(value).slice(0, 10).split('-');
  return y && m && d ? `${d}.${m}.${y}` : String(value);
};

const LINK_FIELDS = [
  { key: 'visited_locations', label: 'Відвідані локації', hint: 'Посилання на локації — кнопка «Запис» або @' },
  { key: 'related_events', label: 'Пов’язані події', hint: 'Події хронології — кнопка «Запис» або @' },
  { key: 'npcs', label: 'НІПи', hint: 'Персонажі майстра — кнопка «Запис» або @' },
];

export default function SessionsPanel({ campaignId, isGm, version }) {
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
    <Card className="p-4">
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
        <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSheetSession(s)}
                className="w-full rounded-lg border border-border px-3 py-2 text-left hover:border-accent/50"
              >
                <p className="truncate text-sm text-text">{s.title}</p>
                {s.session_date && <p className="text-xs text-text-dim">{formatDate(s.session_date)}</p>}
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
    </Card>
  );
}

function SessionSheet({ session, isGm, campaignId, onClose, onSaved, onDeleted }) {
  const isNew = !!session && !session.id;
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [links, setLinks] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    setTitle(session.title ?? '');
    setContent(session.content ?? '');
    setDate(session.session_date ? String(session.session_date).slice(0, 10) : '');
    setLinks(Object.fromEntries(LINK_FIELDS.map((f) => [f.key, session[f.key] ?? ''])));
    setError('');
  }, [session]);

  if (!session) return null;

  const handleSave = async () => {
    if (!title.trim()) { setError('Вкажіть назву сесії'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { title: title.trim(), content, session_date: date || null, ...links };
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
          {LINK_FIELDS.map((f) => (
            <SmartTextarea key={f.key} label={f.label} hint={f.hint} rows={2} value={links[f.key] ?? ''}
              onChange={(e) => setLinks((prev) => ({ ...prev, [f.key]: e.target.value }))} />
          ))}
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
          {session.session_date && <p className="mb-2 text-xs text-text-dim">{formatDate(session.session_date)}</p>}
          {session.content ? (
            <SmartTextReader text={session.content} className="text-sm text-text" />
          ) : (
            <p className="text-sm text-text-dim">Без опису.</p>
          )}
          {LINK_FIELDS.filter((f) => session[f.key]).map((f) => (
            <div key={f.key} className="mt-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">{f.label}</p>
              <SmartTextReader text={session[f.key]} className="text-sm text-text" />
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
