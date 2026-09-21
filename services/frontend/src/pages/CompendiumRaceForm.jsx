import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import compendiumApi from '../api/compendium';
import { COLLECTION_DOMAINS } from '../collectionsDomains';
import Field, { inputClass } from '../components/ui/Field';
import SmartTextarea from '../components/ui/SmartTextarea';
import Button from '../components/ui/Button';
import KindSwitch from '../components/KindSwitch';

const domain = COLLECTION_DOMAINS.compendium;

const EMPTY = { name: '', description: '', origin: '', is_public: false };

// Same shape for race and people (people just adds a required race_id and
// an origin field) — one form, not two near-identical copies. Mirrors
// CompendiumSpeciesForm.jsx, minus health_die (races/peoples don't carry one).
export default function CompendiumRaceForm({ isPeople = false }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const presetRaceId = searchParams.get('race_id') || '';

  const [form, setForm] = useState(EMPTY);
  const [raceId, setRaceId] = useState(presetRaceId);
  const [raceOptions, setRaceOptions] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isPeople) compendiumApi.listRaces().then(setRaceOptions).catch(() => {});
  }, [isPeople]);

  useEffect(() => {
    if (!isEdit) return;
    const load = isPeople ? compendiumApi.getPeople(id) : compendiumApi.getRace(id);
    load
      .then((r) => {
        setForm({ name: r.name, description: r.description || '', origin: r.origin || '', is_public: r.is_public });
        if (isPeople) setRaceId(r.race_id);
      })
      .catch(() => navigate('/compendium/taxonomy'))
      .finally(() => setLoading(false));
  }, [id, isEdit, isPeople]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(isPeople ? 'Вкажи назву народу' : 'Вкажи назву раси'); return; }
    if (isPeople && !raceId) { setError('Обери расу'); return; }
    setSaving(true);
    setError('');
    try {
      if (isPeople) {
        const payload = { name: form.name, description: form.description, origin: form.origin, is_public: form.is_public };
        if (isEdit) {
          await compendiumApi.updatePeople(id, payload);
          navigate(`/compendium/races/${raceId}`);
        } else {
          await compendiumApi.createPeople({ ...payload, race_id: raceId });
          navigate(`/compendium/races/${raceId}`);
        }
      } else {
        const payload = { name: form.name, description: form.description, is_public: form.is_public };
        if (isEdit) {
          await compendiumApi.updateRace(id, payload);
          navigate(`/compendium/races/${id}`);
        } else {
          const created = await compendiumApi.createRace(payload);
          navigate(`/compendium/races/${created.id}`);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  const backTo = isPeople && raceId ? `/compendium/races/${raceId}` : '/compendium/taxonomy';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6 md:pb-8">
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Народи та види
      </Link>

      <h1 className="mb-6 font-display text-2xl text-accent">
        {isEdit ? 'Редагування' : 'Новий'} {isPeople ? 'народ' : 'раса'}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormSection title="Загальне">
          {!isPeople && (
            <Field label="Тип" className="mb-4">
              <KindSwitch kinds={domain.kindSwitch} active="race" />
            </Field>
          )}
          {isPeople && (
            <Field label="Раса" className="mb-4">
              <select className={inputClass} value={raceId} onChange={(e) => setRaceId(e.target.value)} required>
                <option value="">Обери расу</option>
                {raceOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
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
          <SmartTextarea
            label="Опис" className={isPeople ? 'mb-4' : ''} rows={4} value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Загальні риси, культура, середовище проживання..."
          />
          {isPeople && (
            <SmartTextarea
              label="Походження народу" hint="Звідки походить цей народ, його історія в межах раси."
              rows={3} value={form.origin}
              onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
            />
          )}
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

        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex justify-end gap-3 border-t border-border bg-surface px-4 py-3 md:static md:border-0 md:bg-transparent md:px-0 md:py-0">
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
