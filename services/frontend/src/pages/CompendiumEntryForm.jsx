import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import compendiumApi from '../api/compendium';
import equipmentApi from '../api/equipment';
import spellbookApi from '../api/spellbook';
import maneuversApi from '../api/maneuvers';
import { ENTITY_TYPES, ATTRIBUTE_LABELS } from '../constants/compendium';
import Field, { inputClass } from '../components/ui/Field';
import SmartTextarea from '../components/ui/SmartTextarea';
import ImageUploadField from '../components/ui/ImageUploadField';
import Button from '../components/ui/Button';
import CatalogAttachPicker from '../components/compendium/CatalogAttachPicker';

const ATTRIBUTE_KEYS = Object.keys(ATTRIBUTE_LABELS);

const EMPTY = {
  name: '', entity_type: 'npc', species_id: '', subspecies_id: '',
  description: '', history: '', motivation: '', backstory: '', faction: '', image_url: '',
  dexterity: 3, body: 3, intelligence: 3, wisdom: 3, charisma: 3,
  is_public: false,
};

export default function CompendiumEntryForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const presetType = searchParams.get('type') === 'creature' ? 'creature' : 'npc';

  const [form, setForm] = useState({ ...EMPTY, entity_type: presetType });
  const [species, setSpecies] = useState([]);
  const [subspecies, setSubspecies] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [equipment, setEquipment] = useState([]);
  const [spells, setSpells] = useState([]);
  const [maneuvers, setManeuvers] = useState([]);

  useEffect(() => { compendiumApi.listSpecies().then(setSpecies).catch(() => {}); }, []);

  useEffect(() => {
    if (!form.species_id) { setSubspecies([]); return; }
    compendiumApi.listSubspecies(form.species_id).then(setSubspecies).catch(() => {});
  }, [form.species_id]);

  useEffect(() => {
    if (!isEdit) return;
    compendiumApi.getEntry(id)
      .then((e) => {
        setForm({
          name: e.name, entity_type: e.entity_type,
          species_id: e.species_id || '', subspecies_id: e.subspecies_id || '',
          description: e.description || '', history: e.history || '',
          motivation: e.motivation || '', backstory: e.backstory || '', faction: e.faction || '',
          image_url: e.image_url || '',
          dexterity: e.dexterity, body: e.body, intelligence: e.intelligence, wisdom: e.wisdom, charisma: e.charisma,
          is_public: e.is_public,
        });
      })
      .catch(() => navigate('/compendium'))
      .finally(() => setLoading(false));
  }, [id]);

  const reloadRelations = () => {
    if (!isEdit) return;
    compendiumApi.listEntryEquipment(id).then(setEquipment).catch(() => {});
    compendiumApi.listEntrySpells(id).then(setSpells).catch(() => {});
    compendiumApi.listEntryManeuvers(id).then(setManeuvers).catch(() => {});
  };

  useEffect(reloadRelations, [id, isEdit]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setAttr = (key) => (e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Вкажи назву'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        species_id: form.species_id || null,
        subspecies_id: form.subspecies_id || null,
        image_url: form.image_url || null,
        ...Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, Number(form[k])])),
      };
      if (isEdit) {
        await compendiumApi.updateEntry(id, payload);
        navigate(`/compendium/entries/${id}`);
      } else {
        const created = await compendiumApi.createEntry(payload);
        navigate(`/compendium/entries/${created.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  const isNpc = form.entity_type === 'npc';
  const type = ENTITY_TYPES[form.entity_type];
  const backTo = isEdit ? `/compendium/entries/${id}` : (isNpc ? '/compendium' : '/compendium/bestiary');

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6 md:pb-8">
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> НІПи та істоти
      </Link>

      <h1 className="mb-6 font-display text-2xl text-accent">
        {isEdit ? `Редагування: ${form.name}` : 'Новий запис'}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormSection title="Загальне" accentColor={type.color}>
          <Field label="Тип" className="mb-4">
            <div className="inline-flex overflow-hidden rounded-lg border border-border">
              {Object.entries(ENTITY_TYPES).map(([key, { label, color }]) => (
                <button
                  key={key} type="button"
                  disabled={isEdit}
                  onClick={() => setForm((f) => ({ ...f, entity_type: key }))}
                  className="min-h-11 px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
                  style={form.entity_type === key
                    ? { background: color, color: 'var(--color-bg)' }
                    : { background: 'var(--color-surface)', color: 'var(--color-text-dim)' }}
                >
                  {label}
                </button>
              ))}
            </div>
            {isEdit && <p className="mt-1.5 text-xs text-text-dim">Тип не можна змінити після створення</p>}
          </Field>

          <Field label="Назва" className="mb-4">
            <input type="text" className={inputClass} value={form.name} onChange={set('name')} required maxLength={200} />
          </Field>

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Вид">
              <select
                className={inputClass} value={form.species_id}
                onChange={(e) => setForm((f) => ({ ...f, species_id: e.target.value, subspecies_id: '' }))}
              >
                <option value="">Не обрано</option>
                {species.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Підвид">
              <select
                className={inputClass} value={form.subspecies_id} onChange={set('subspecies_id')}
                disabled={!form.species_id}
              >
                <option value="">Не обрано</option>
                {subspecies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>

          <ImageUploadField
            value={form.image_url}
            onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
            entityType="item"
          />
        </FormSection>

        <FormSection title="Атрибути (1-6)" accentColor={type.color}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {ATTRIBUTE_KEYS.map((key) => (
              <Field key={key} label={ATTRIBUTE_LABELS[key]}>
                <input
                  type="number" min={1} max={6} className={inputClass}
                  value={form[key]} onChange={setAttr(key)} required
                />
              </Field>
            ))}
          </div>
        </FormSection>

        {isNpc ? (
          <FormSection title="Опис" accentColor={type.color}>
            <SmartTextarea
              label="Опис" value={form.description} onChange={set('description')} rows={4}
              placeholder="Зовнішність, манера поведінки..." className="mb-4"
            />
            <SmartTextarea
              label="Мотивація" value={form.motivation} onChange={set('motivation')} rows={3}
              placeholder="Що рухає цим персонажем..." className="mb-4"
            />
            <SmartTextarea
              label="Передісторія" value={form.backstory} onChange={set('backstory')} rows={4}
              placeholder="Особиста історія персонажа..." className="mb-4"
            />
            <Field label="Фракція">
              <input
                type="text" className={inputClass} value={form.faction} onChange={set('faction')}
                maxLength={200} placeholder="Угруповання, орден, гільдія..."
              />
            </Field>
          </FormSection>
        ) : (
          <FormSection title="Опис" accentColor={type.color}>
            <SmartTextarea
              label="Опис" value={form.description} onChange={set('description')} rows={4}
              placeholder="Зовнішність, поведінка..." className="mb-4"
            />
            <SmartTextarea
              label="Походження" value={form.history} onChange={set('history')} rows={4}
              placeholder="Звідки з'явилась ця істота, її роль у світі..."
            />
          </FormSection>
        )}

        {isEdit && (
          <FormSection title="Спорядження, заклинання, маневри" accentColor={type.color}>
            <div className="flex flex-col gap-5">
              <CatalogAttachPicker
                label="Спорядження" addLabel="Додати предмет"
                catalogApi={equipmentApi} attached={equipment} attachedIdField="equipment_id"
                onAdd={(itemId) => compendiumApi.addEntryEquipment(id, itemId).then(reloadRelations)}
                onRemove={(itemId) => compendiumApi.removeEntryEquipment(id, itemId).then(reloadRelations)}
                itemLink={(item) => `/equipment/${item.id}`}
                itemMeta={(item) => item.damage_die || (item.defense_value != null ? `захист ${item.defense_value}` : '')}
                rollFormula={(item) => item.damage_die && `1${item.damage_die}`}
              />
              <CatalogAttachPicker
                label="Заклинання" addLabel="Додати заклинання"
                catalogApi={spellbookApi} attached={spells} attachedIdField="spell_id"
                onAdd={(itemId) => compendiumApi.addEntrySpell(id, itemId).then(reloadRelations)}
                onRemove={(itemId) => compendiumApi.removeEntrySpell(id, itemId).then(reloadRelations)}
                itemLink={(item) => `/spellbook/${item.id}`}
                itemMeta={(item) => item.spell_kind || ''}
              />
              <CatalogAttachPicker
                label="Маневри" addLabel="Додати маневр"
                catalogApi={maneuversApi} attached={maneuvers} attachedIdField="maneuver_id"
                onAdd={(itemId) => compendiumApi.addEntryManeuver(id, itemId).then(reloadRelations)}
                onRemove={(itemId) => compendiumApi.removeEntryManeuver(id, itemId).then(reloadRelations)}
                itemLink={(item) => `/maneuvers/${item.id}`}
                itemMeta={(item) => (item.duration_actions ? `${item.duration_actions} дії` : '')}
              />
            </div>
          </FormSection>
        )}
        {!isEdit && (
          <p className="text-sm text-text-dim">Збережи запис, щоб додати спорядження, заклинання й маневри.</p>
        )}

        <FormSection title="Налаштування" accentColor={type.color}>
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
