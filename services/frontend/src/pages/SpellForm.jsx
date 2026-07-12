import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import api from '../api/client';
import {
  MAGIC_TYPES, RITUAL_TYPES, DURATION_UNITS,
  ACTION_OPTIONS, SPELL_KINDS,
} from '../constants/spellbook';
import Field, { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';

const EMPTY = {
  name: '', magic_type: 'arcana', spell_kind: 'utility',
  mechanical_desc: '', narrative_desc: '',
  energy_cost: 0, action_time: 1, ritual: 'impossible',
  duration_value: '', duration_unit: 'instant', range_desc: '',
  components: [], is_public: true,
};

export default function SpellForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/api/spellbook/${id}`)
      .then(({ data }) => {
        const s = data.spell;
        setForm({
          name: s.name, magic_type: s.magic_type, spell_kind: s.spell_kind || 'utility',
          mechanical_desc: s.mechanical_desc || '',
          narrative_desc: s.narrative_desc || '',
          energy_cost: s.energy_cost, action_time: s.action_time,
          ritual: s.ritual, duration_value: s.duration_value ?? '',
          duration_unit: s.duration_unit, range_desc: s.range_desc || '',
          components: s.components || [], is_public: s.is_public,
        });
      })
      .catch(() => navigate('/spellbook'))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setNum = (field) => (e) => setForm((f) => ({ ...f, [field]: Number(e.target.value) }));

  const addComponent = () => setForm((f) => ({ ...f, components: [...f.components, ''] }));
  const removeComponent = (i) => setForm((f) => ({
    ...f, components: f.components.filter((_, idx) => idx !== i),
  }));
  const setComponent = (i, val) => setForm((f) => ({
    ...f,
    components: f.components.map((c, idx) => (idx === i ? val : c)),
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Вкажи назву заклинання'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        components: form.components.filter((c) => c.trim() !== ''),
        duration_value: form.duration_value === '' ? null : Number(form.duration_value),
        energy_cost: Number(form.energy_cost),
        action_time: Number(form.action_time),
      };
      if (isEdit) {
        await api.put(`/api/spellbook/${id}`, payload);
        navigate(`/spellbook/${id}`);
      } else {
        const { data } = await api.post('/api/spellbook/', payload);
        navigate(`/spellbook/${data.spell.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  const activeType = MAGIC_TYPES[form.magic_type] || MAGIC_TYPES.arcana;

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6 md:pb-8">
      <Link to="/spellbook" className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Книга заклинань
      </Link>

      <h1 className="mb-6 font-display text-2xl text-accent">
        {isEdit ? 'Редагування заклинання' : 'Нове заклинання'}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* — Загальне — */}
        <FormSection title="Загальне" accentColor={activeType.color}>
          <Field label="Назва заклинання" className="mb-4">
            <input type="text" className={inputClass} value={form.name} onChange={set('name')} required maxLength={200} />
          </Field>

          <Field label="Тип магії" className="mb-4">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(MAGIC_TYPES).map(([key, { label, color }]) => (
                <button
                  key={key} type="button"
                  onClick={() => setForm((f) => ({ ...f, magic_type: key }))}
                  className="rounded border px-3 py-1.5 text-sm font-semibold transition-colors"
                  style={form.magic_type === key
                    ? { borderColor: color, color, background: color + '1a' }
                    : { borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Вид заклинання">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SPELL_KINDS).map(([key, { label }]) => (
                <button
                  key={key} type="button"
                  onClick={() => setForm((f) => ({ ...f, spell_kind: key }))}
                  className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    form.spell_kind === key
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-border text-text-dim'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        </FormSection>

        {/* — Механіка — */}
        <FormSection title="Механіка" accentColor={activeType.color}>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Магічна енергія">
              <input type="number" min={0} className={inputClass} value={form.energy_cost} onChange={setNum('energy_cost')} />
            </Field>
            <Field label="Час виконання">
              <select className={inputClass} value={form.action_time} onChange={setNum('action_time')}>
                {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Ритуал">
              <select className={inputClass} value={form.ritual} onChange={set('ritual')}>
                {Object.entries(RITUAL_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Тривалість">
              <div className="flex gap-2">
                {form.duration_unit !== 'instant' && form.duration_unit !== 'permanent' && (
                  <input
                    type="number" min={1} className={`${inputClass} w-20`} value={form.duration_value}
                    onChange={set('duration_value')}
                  />
                )}
                <select className={`${inputClass} flex-1`} value={form.duration_unit} onChange={set('duration_unit')}>
                  {Object.entries(DURATION_UNITS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </Field>
            <Field label="Дальність">
              <input
                type="text" className={inputClass} value={form.range_desc} onChange={set('range_desc')}
                placeholder="напр. Дотик, 10 метрів, Себе..." maxLength={200}
              />
            </Field>
          </div>

          <Field label="Компоненти">
            <div className="flex flex-col gap-2">
              {form.components.map((comp, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    className={`${inputClass} flex-1`}
                    value={comp}
                    onChange={(e) => setComponent(i, e.target.value)}
                    placeholder={`Компонент ${i + 1}`}
                    maxLength={100}
                  />
                  <button
                    type="button"
                    onClick={() => removeComponent(i)}
                    title="Видалити"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-danger/40 text-danger"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button" onClick={addComponent}
                className="inline-flex w-fit items-center gap-1.5 rounded border border-dashed border-border px-3 py-1.5 text-sm text-text-dim"
              >
                <Plus size={14} /> Додати компонент
              </button>
            </div>
          </Field>
        </FormSection>

        {/* — Описи — */}
        <FormSection title="Описи" accentColor={activeType.color}>
          <Field label="Механічний опис" className="mb-4">
            <textarea
              className={`${inputClass} resize-y`}
              value={form.mechanical_desc} onChange={set('mechanical_desc')}
              rows={4}
              placeholder="Що відбувається механічно: кидки, шкода, ефекти..."
            />
          </Field>
          <Field label="Наративний опис">
            <textarea
              className={`${inputClass} resize-y italic`}
              value={form.narrative_desc} onChange={set('narrative_desc')}
              rows={3}
              placeholder="Як це виглядає та відчувається у світі гри..."
            />
          </Field>
        </FormSection>

        {/* — Налаштування — */}
        <FormSection title="Налаштування" accentColor={activeType.color}>
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

        {/* Sticky save bar — stays reachable by thumb on mobile, above BottomNav */}
        <div className="fixed inset-x-0 bottom-16 z-30 flex justify-end gap-3 border-t border-border bg-surface px-4 py-3 md:static md:border-0 md:bg-transparent md:px-0 md:py-0">
          <Button type="button" variant="ghost" to={isEdit ? `/spellbook/${id}` : '/spellbook'}>
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

function FormSection({ title, accentColor, children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b bg-bg px-4 py-2" style={{ borderBottomColor: accentColor + '55' }}>
        <span className="text-xs font-bold uppercase tracking-wide text-text-dim">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
