import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import chronologyApi from '../api/chronology';
import Button from '../components/ui/Button';
import CardOverlayButton from '../components/ui/CardOverlayButton';
import CalendarCard from '../components/chronology/CalendarCard';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Field, { inputClass } from '../components/ui/Field';
import Sheet from '../components/ui/Sheet';

export default function ChronologyList() {
  const { user } = useAuth();
  // Керування календарями (створення, побудова структури) — рольове, не
  // власницьке: будь-який admin/game_master керує будь-яким календарем,
  // так само як на бекенді (requireChronologyManager).
  const canManage = user?.role === 'admin' || user?.role === 'game_master';

  const [calendars, setCalendars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    chronologyApi.list()
      .then(setCalendars)
      .catch(() => setError('Не вдалось завантажити календарі'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <PageHeader
        title="🗓️ Хронологія"
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
              to={`/chronology/${c.id}`}
              actions={canManage && (
                <CardOverlayButton label="Побудувати структуру" onClick={() => navigate(`/chronology/${c.id}/build`)}>
                  <Settings size={15} />
                </CardOverlayButton>
              )}
            />
          ))}
        </div>
      )}

      <NewCalendarSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(calendar) => navigate(`/chronology/${calendar.id}/build`)}
      />
    </div>
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
      const calendar = await chronologyApi.create({ name: name.trim() });
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
