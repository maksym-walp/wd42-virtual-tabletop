import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import traditionsApi from '../api/traditions';
import { COLLECTION_DOMAINS } from '../collectionsDomains';
import Field, { inputClass } from '../components/ui/Field';
import SmartTextarea from '../components/ui/SmartTextarea';
import Button from '../components/ui/Button';
import KindSwitch from '../components/KindSwitch';

const domain = COLLECTION_DOMAINS.spellbook;

const EMPTY = { name: '', description: '', founders: '' };

export default function TraditionForm() {
  const { user } = useAuth();
  const canManageTraditions = user?.role === 'admin' || user?.role === 'game_master';
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Server also enforces this (requireCanonicalManager) — this is just
  // defense in depth so a regular user never sees the form flash open.
  useEffect(() => {
    if (!canManageTraditions) navigate('/spellbook/traditions');
  }, [canManageTraditions]);

  useEffect(() => {
    if (!isEdit) return;
    traditionsApi.getOne(id)
      .then((t) => setForm({
        name: t.name, description: t.description || '', founders: t.founders || '',
      }))
      .catch(() => navigate('/spellbook/traditions'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Вкажи назву традиції'); return; }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await traditionsApi.update(id, form);
        navigate('/spellbook/traditions');
      } else {
        await traditionsApi.create(form);
        navigate('/spellbook/traditions');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  if (!canManageTraditions || loading) {
    return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6 md:pb-8">
      <Link to="/spellbook/traditions" className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Магічні традиції
      </Link>

      <h1 className="mb-6 font-display text-2xl text-accent">
        {isEdit ? 'Редагування традиції' : 'Нова традиція'}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormSection title="Загальне">
          <Field label="Тип" className="mb-4">
            <KindSwitch kinds={domain.kindSwitch} active="tradition" />
          </Field>
          <Field label="Назва" className="mb-4">
            <input
              type="text" className={inputClass} value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required maxLength={200}
            />
          </Field>
          <Field label="Засновники" className="mb-4" hint="напр. Архімаг Ельдран Сірий, орден Сірого Полум'я...">
            <input
              type="text" className={inputClass} value={form.founders}
              onChange={(e) => setForm((f) => ({ ...f, founders: e.target.value }))}
              maxLength={200}
            />
          </Field>
          <SmartTextarea
            label="Опис"
            rows={4} value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Історія та принципи традиції..."
          />
        </FormSection>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="fixed inset-x-0 bottom-16 z-30 flex justify-end gap-3 border-t border-border bg-surface px-4 py-3 md:static md:border-0 md:bg-transparent md:px-0 md:py-0">
          <Button type="button" variant="ghost" to="/spellbook/traditions">
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
