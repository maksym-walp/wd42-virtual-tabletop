import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import { DURATION_OPTIONS } from '../constants/maneuvers';
import Field, { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';

const EMPTY = { name: '', duration_actions: 1, description: '', is_public: true };

export default function ManeuverForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/api/maneuvers/${id}`)
      .then(({ data }) => {
        const m = data.maneuver;
        setForm({
          name: m.name, duration_actions: m.duration_actions,
          description: m.description || '', is_public: m.is_public,
        });
      })
      .catch(() => navigate('/maneuvers'))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setNum = (field) => (e) => setForm((f) => ({ ...f, [field]: Number(e.target.value) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Вкажи назву маневру'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, duration_actions: Number(form.duration_actions) };
      if (isEdit) {
        await api.put(`/api/maneuvers/${id}`, payload);
        navigate(`/maneuvers/${id}`);
      } else {
        const { data } = await api.post('/api/maneuvers/', payload);
        navigate(`/maneuvers/${data.maneuver.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6 md:pb-8">
      <Link to="/maneuvers" className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Маневри
      </Link>

      <h1 className="mb-6 font-display text-2xl text-accent">
        {isEdit ? 'Редагування маневру' : 'Новий маневр'}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormSection title="Загальне">
          <Field label="Назва" className="mb-4">
            <input type="text" className={inputClass} value={form.name} onChange={set('name')} required maxLength={200} />
          </Field>

          <Field label="Тривалість">
            <select className={inputClass} value={form.duration_actions} onChange={setNum('duration_actions')}>
              {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </FormSection>

        <FormSection title="Опис">
          <textarea
            className={`${inputClass} resize-y`}
            value={form.description} onChange={set('description')}
            rows={4}
            placeholder="Що відбувається механічно, коли персонаж виконує цей маневр..."
          />
        </FormSection>

        <FormSection title="Налаштування">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
            <input
              type="checkbox" checked={form.is_public}
              onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
              className="h-5 w-5 accent-accent"
            />
            Публічне — видиме всім гравцям
          </label>
        </FormSection>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="fixed inset-x-0 bottom-16 z-30 flex justify-end gap-3 border-t border-border bg-surface px-4 py-3 md:static md:border-0 md:bg-transparent md:px-0 md:py-0">
          <Button type="button" variant="ghost" to={isEdit ? `/maneuvers/${id}` : '/maneuvers'}>
            Скасувати
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Збереження...' : 'Зберегти'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function FormSection({ title, children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-border bg-bg px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-text-dim">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
