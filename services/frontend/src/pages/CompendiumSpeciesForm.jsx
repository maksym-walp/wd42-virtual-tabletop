import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import compendiumApi from '../api/compendium';
import { HEALTH_DICE } from '../constants/compendium';
import { COLLECTION_DOMAINS } from '../collectionsDomains';
import Field, { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import KindSwitch from '../components/KindSwitch';

const domain = COLLECTION_DOMAINS.compendium;

const EMPTY = { name: '', description: '', is_public: false, health_die: 'd6' };

// Same shape for species and subspecies (subspecies just adds a required
// species_id) — one form, not two near-identical copies.
export default function CompendiumSpeciesForm({ isSubspecies = false }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const presetSpeciesId = searchParams.get('species_id') || '';

  const [form, setForm] = useState(EMPTY);
  const [speciesId, setSpeciesId] = useState(presetSpeciesId);
  const [speciesOptions, setSpeciesOptions] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isSubspecies) compendiumApi.listSpecies().then(setSpeciesOptions).catch(() => {});
  }, [isSubspecies]);

  useEffect(() => {
    if (!isEdit) return;
    const load = isSubspecies ? compendiumApi.getSubspecies(id) : compendiumApi.getSpecies(id);
    load
      .then((s) => {
        setForm({ name: s.name, description: s.description || '', is_public: s.is_public, health_die: s.health_die || 'd6' });
        if (isSubspecies) setSpeciesId(s.species_id);
      })
      .catch(() => navigate(isSubspecies ? '/compendium/species' : '/compendium/species'))
      .finally(() => setLoading(false));
  }, [id, isEdit, isSubspecies]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(isSubspecies ? 'Вкажи назву підвиду' : 'Вкажи назву виду'); return; }
    if (isSubspecies && !speciesId) { setError('Обери вид'); return; }
    setSaving(true);
    setError('');
    try {
      if (isSubspecies) {
        if (isEdit) {
          await compendiumApi.updateSubspecies(id, form);
          navigate(`/compendium/species/${speciesId}`);
        } else {
          await compendiumApi.createSubspecies({ ...form, species_id: speciesId });
          navigate(`/compendium/species/${speciesId}`);
        }
      } else if (isEdit) {
        await compendiumApi.updateSpecies(id, form);
        navigate(`/compendium/species/${id}`);
      } else {
        const created = await compendiumApi.createSpecies(form);
        navigate(`/compendium/species/${created.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  const backTo = isSubspecies && speciesId ? `/compendium/species/${speciesId}` : '/compendium/species';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6 md:pb-8">
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Види
      </Link>

      <h1 className="mb-6 font-display text-2xl text-accent">
        {isEdit ? 'Редагування' : 'Новий'} {isSubspecies ? 'підвид' : 'вид'}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormSection title="Загальне">
          {!isSubspecies && (
            <Field label="Тип" className="mb-4">
              <KindSwitch kinds={domain.kindSwitch} active="species" />
            </Field>
          )}
          {isSubspecies && (
            <Field label="Вид" className="mb-4">
              <select className={inputClass} value={speciesId} onChange={(e) => setSpeciesId(e.target.value)} required>
                <option value="">Обери вид</option>
                {speciesOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Назва" className="mb-4">
            <input
              type="text" className={inputClass} value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required maxLength={200}
            />
          </Field>
          <Field label="Опис" className="mb-4">
            <textarea
              className={`${inputClass} resize-y`} rows={4} value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Загальні риси, культура, середовище проживання..."
            />
          </Field>
          <Field label="Кубик здоров'я" hint="Використовується для розрахунку здоровʼя записів цього виду/підвиду.">
            <select
              className={inputClass} value={form.health_die}
              onChange={(e) => setForm((f) => ({ ...f, health_die: e.target.value }))}
            >
              {HEALTH_DICE.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </FormSection>

        <FormSection title="Налаштування">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
            <input
              type="checkbox" checked={form.is_public}
              onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
              className="h-5 w-5 accent-accent"
            />
            Публічний — видимий усім гравцям
          </label>
        </FormSection>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="fixed inset-x-0 bottom-16 z-30 flex justify-end gap-3 border-t border-border bg-surface px-4 py-3 md:static md:border-0 md:bg-transparent md:px-0 md:py-0">
          <Button type="button" variant="ghost" to={backTo}>Скасувати</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Збереження...' : 'Зберегти'}</Button>
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
