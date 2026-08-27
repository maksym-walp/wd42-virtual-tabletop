import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import calendarApi from '../api/calendar';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Field, { inputClass } from '../components/ui/Field';
import Sheet from '../components/ui/Sheet';

export default function CalendarList() {
  const { user } = useAuth();
  // Керування календарями (створення, побудова структури) — рольове, не
  // власницьке: будь-який admin/game_master керує будь-яким календарем,
  // так само як на бекенді (requireCalendarManager).
  const canManage = user?.role === 'admin' || user?.role === 'game_master';

  const [calendars, setCalendars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    calendarApi.list()
      .then(setCalendars)
      .catch(() => setError('Не вдалось завантажити календарі'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <PageHeader
        title="🗓️ Календарі"
        action={canManage && <Button onClick={() => setCreateOpen(true)}>+ Новий календар</Button>}
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {calendars.length === 0 ? (
        <EmptyState icon="🗓️" title="Ще немає жодного календаря">
          {canManage ? 'Створіть перший, щоб почати вести літочислення світу' : 'Майстер ще не створив календар'}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {calendars.map((c) => (
            <CalendarCard
              key={c.id}
              calendar={c}
              canManage={canManage}
              onClick={() => navigate(`/calendars/${c.id}`)}
              onManage={() => navigate(`/calendars/build/${c.id}`)}
            />
          ))}
        </div>
      )}

      <NewCalendarSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(calendar) => navigate(`/calendars/build/${calendar.id}`)}
      />
    </div>
  );
}

function CalendarCard({ calendar: c, canManage, onClick, onManage }) {
  return (
    <Card onClick={onClick} className="cursor-pointer hover:border-accent/50">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2 className="font-display text-lg text-text">{c.name}</h2>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge className={c.is_private ? 'border border-border text-text-dim' : 'bg-sage text-bg'}>
            {c.is_private ? 'Приватний' : 'Публічний'}
          </Badge>
          {canManage && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onManage(); }}
              aria-label="Побудувати структуру"
              className="rounded p-1 text-text-dim hover:bg-surface-hover hover:text-text"
            >
              <Settings size={15} />
            </button>
          )}
        </div>
      </div>
      {c.description && <p className="text-sm text-text-dim">{c.description}</p>}
    </Card>
  );
}

function NewCalendarSheet({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setError('');
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) { setError('Вкажіть назву календаря'); return; }
    setSaving(true);
    setError('');
    try {
      const calendar = await calendarApi.create({ name: name.trim() });
      onClose();
      onCreated(calendar);
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при створенні');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Новий календар">
      <div className="flex flex-col gap-4">
        <Field label="Назва">
          <input
            autoFocus
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Наприклад, Літочислення Гарії"
            maxLength={200}
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={handleCreate} disabled={saving}>
          {saving ? 'Створення...' : 'Створити й перейти до налаштувань'}
        </Button>
      </div>
    </Sheet>
  );
}
