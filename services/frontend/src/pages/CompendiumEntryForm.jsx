import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import compendiumApi from '../api/compendium';
import equipmentApi from '../api/equipment';
import spellbookApi from '../api/spellbook';
import abilitiesApi from '../api/abilities';
import { ATTRIBUTE_LABELS, ENTITY_TYPES, GENDER_OPTIONS, HEALTH_DICE } from '../constants/compendium';
import { COLLECTION_DOMAINS } from '../collectionsDomains';
import Field, { inputClass } from '../components/ui/Field';
import SmartTextarea from '../components/ui/SmartTextarea';
import ImageUploadField from '../components/ui/ImageUploadField';
import Button from '../components/ui/Button';
import CatalogAttachPicker from '../components/compendium/CatalogAttachPicker';
import BirthDatePicker from '../components/compendium/BirthDatePicker';
import KindSwitch from '../components/KindSwitch';

const domain = COLLECTION_DOMAINS.compendium;
const ATTRIBUTE_KEYS = Object.keys(ATTRIBUTE_LABELS);

const EMPTY = {
  name: '', entity_type: 'npc', species_id: '', subspecies_id: '', race_id: '', people_id: '',
  description: '', history: '', motivation: '', backstory: '', faction: '', image_url: '',
  dexterity: 3, body: 3, intelligence: 3, wisdom: 3, charisma: 3,
  is_public: false,
  age: '', gender: '', birth_calendar_id: '', birth_year: '', birth_month_id: '', birth_day: '',
  health_die_override: '', private_notes: '',
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
  const [races, setRaces] = useState([]);
  const [peoples, setPeoples] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [equipment, setEquipment] = useState([]);
  const [spells, setSpells] = useState([]);
  const [abilities, setAbilities] = useState([]);

  useEffect(() => { compendiumApi.listSpecies().then(setSpecies).catch(() => {}); }, []);
  useEffect(() => { compendiumApi.listRaces().then(setRaces).catch(() => {}); }, []);

  useEffect(() => {
    if (!form.species_id) { setSubspecies([]); return; }
    compendiumApi.listSubspecies(form.species_id).then(setSubspecies).catch(() => {});
  }, [form.species_id]);

  useEffect(() => {
    if (!form.race_id) { setPeoples([]); return; }
    compendiumApi.listPeoples(form.race_id).then(setPeoples).catch(() => {});
  }, [form.race_id]);

  useEffect(() => {
    if (!isEdit) return;
    compendiumApi.getEntry(id)
      .then((e) => {
        setForm({
          name: e.name, entity_type: e.entity_type,
          species_id: e.species_id || '', subspecies_id: e.subspecies_id || '',
          race_id: e.race_id || '', people_id: e.people_id || '',
          description: e.description || '', history: e.history || '',
          motivation: e.motivation || '', backstory: e.backstory || '', faction: e.faction || '',
          image_url: e.image_url || '',
          dexterity: e.dexterity, body: e.body, intelligence: e.intelligence, wisdom: e.wisdom, charisma: e.charisma,
          is_public: e.is_public,
          age: e.age ?? '', gender: e.gender || '',
          birth_calendar_id: e.birth_calendar_id || '', birth_year: e.birth_year ?? '',
          birth_month_id: e.birth_month_id || '', birth_day: e.birth_day ?? '',
          health_die_override: e.health_die_override || '', private_notes: e.private_notes || '',
        });
      })
      .catch(() => navigate('/compendium'))
      .finally(() => setLoading(false));
  }, [id]);

  const reloadRelations = () => {
    if (!isEdit) return;
    compendiumApi.listEntryEquipment(id).then(setEquipment).catch(() => {});
    compendiumApi.listEntrySpells(id).then(setSpells).catch(() => {});
    compendiumApi.listEntryAbilities(id).then(setAbilities).catch(() => {});
  };

  useEffect(reloadRelations, [id, isEdit]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setAttr = (key) => (e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }));

  // "Вид/раса" and "Підвид/народ" are one field each in the UI, backed by
  // two different catalogs (species/subspecies vs race/people) under the
  // hood — the value is prefixed to tell them apart, and picking either
  // clears the other catalog's fields so only one stays set on the entry.
  const taxonomyValue = form.species_id ? `species:${form.species_id}` : (form.race_id ? `race:${form.race_id}` : '');
  const handleTaxonomyChange = (e) => {
    const v = e.target.value;
    if (!v) { setForm((f) => ({ ...f, species_id: '', subspecies_id: '', race_id: '', people_id: '' })); return; }
    const [kind, rawId] = v.split(':');
    setForm((f) => (kind === 'species'
      ? { ...f, species_id: rawId, subspecies_id: '', race_id: '', people_id: '' }
      : { ...f, race_id: rawId, people_id: '', species_id: '', subspecies_id: '' }));
  };
  const subKind = form.species_id ? 'species' : (form.race_id ? 'race' : null);
  const subOptions = subKind === 'species' ? subspecies : (subKind === 'race' ? peoples : []);
  const subValue = subKind === 'species' ? form.subspecies_id : (subKind === 'race' ? form.people_id : '');
  const handleSubChange = (e) => {
    const v = e.target.value;
    setForm((f) => (subKind === 'species' ? { ...f, subspecies_id: v } : { ...f, people_id: v }));
  };

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
        race_id: form.race_id || null,
        people_id: form.people_id || null,
        image_url: form.image_url || null,
        ...Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, Number(form[k])])),
        age: form.age === '' ? null : Number(form.age),
        gender: form.gender || null,
        birth_calendar_id: form.birth_calendar_id || null,
        birth_year: form.birth_year === '' ? null : Number(form.birth_year),
        birth_month_id: form.birth_month_id || null,
        birth_day: form.birth_day === '' ? null : Number(form.birth_day),
        health_die_override: form.health_die_override || null,
        private_notes: form.private_notes || null,
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
  const backTo = isEdit ? `/compendium/entries/${id}` : (isNpc ? '/compendium' : '/compendium/bestiary');

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6 md:pb-8">
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> {isEdit ? form.name : (isNpc ? 'НІПи' : 'Бестіарій')}
      </Link>

      <h1 className="mb-6 font-display text-2xl text-accent">
        {isEdit ? `Редагування: ${form.name}` : (ENTITY_TYPES[form.entity_type]?.newLabel || 'Новий запис')}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormSection title="Загальне">
          <Field label="Тип" className="mb-4">
            <KindSwitch
              kinds={domain.kindSwitch}
              active={form.entity_type}
              localKeys={['npc', 'creature']}
              onSelectLocal={(key) => setForm((f) => ({ ...f, entity_type: key }))}
              localDisabled={isEdit}
            />
            {isEdit && <p className="mt-1.5 text-xs text-text-dim">Тип не можна змінити після створення</p>}
          </Field>

          <Field label="Назва" className="mb-4">
            <input type="text" className={inputClass} value={form.name} onChange={set('name')} required maxLength={200} />
          </Field>

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Вид/раса">
              <select className={inputClass} value={taxonomyValue} onChange={handleTaxonomyChange}>
                <option value="">Не обрано</option>
                {species.length > 0 && (
                  <optgroup label="Види">
                    {species.map((s) => <option key={`species:${s.id}`} value={`species:${s.id}`}>{s.name}</option>)}
                  </optgroup>
                )}
                {races.length > 0 && (
                  <optgroup label="Раси">
                    {races.map((r) => <option key={`race:${r.id}`} value={`race:${r.id}`}>{r.name}</option>)}
                  </optgroup>
                )}
              </select>
            </Field>
            <Field label="Підвид/народ">
              <select className={inputClass} value={subValue} onChange={handleSubChange} disabled={!subKind}>
                <option value="">Не обрано</option>
                {subOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
          </div>

          <ImageUploadField
            value={form.image_url}
            onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
            entityType="item"
          />
        </FormSection>

        <FormSection title="Атрибути (1-6)">
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
          {isNpc && (
            <Field
              label="Кубик здоров'я" className="mt-4"
              hint="За замовчуванням береться з обраного виду/раси (або d6, якщо не обрано) — тут можна задати власний."
            >
              <select className={inputClass} value={form.health_die_override} onChange={set('health_die_override')}>
                <option value="">Успадкувати від виду/раси</option>
                {HEALTH_DICE.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          )}
        </FormSection>

        {isNpc && (
          <FormSection title="Опис">
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
        )}

        {isNpc && (
          <FormSection title="Біографія">
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Вік">
                <input type="number" min={0} className={inputClass} value={form.age} onChange={set('age')} />
              </Field>
              <Field label="Стать">
                <select className={inputClass} value={form.gender} onChange={set('gender')}>
                  <option value="">Не вказано</option>
                  {Object.entries(GENDER_OPTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Дата народження">
              <BirthDatePicker
                value={{
                  calendarId: form.birth_calendar_id, year: form.birth_year,
                  monthId: form.birth_month_id, day: form.birth_day,
                }}
                onChange={(v) => setForm((f) => ({
                  ...f, birth_calendar_id: v.calendarId, birth_year: v.year, birth_month_id: v.monthId, birth_day: v.day,
                }))}
              />
            </Field>
          </FormSection>
        )}

        {!isNpc && (
          <FormSection title="Опис">
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
          <FormSection title="Спорядження, заклинання, вміння">
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
                label="Вміння" addLabel="Додати вміння"
                catalogApi={abilitiesApi} attached={abilities} attachedIdField="ability_id"
                onAdd={(itemId) => compendiumApi.addEntryAbility(id, itemId).then(reloadRelations)}
                onRemove={(itemId) => compendiumApi.removeEntryAbility(id, itemId).then(reloadRelations)}
                itemLink={(item) => `/abilities/${item.id}`}
                itemMeta={(item) => (item.archetypes || []).join(', ')}
              />
            </div>
          </FormSection>
        )}
        {!isEdit && (
          <p className="text-sm text-text-dim">Збережи запис, щоб додати спорядження, заклинання й вміння.</p>
        )}

        {isNpc && (
          <FormSection title="Приватні нотатки">
            <SmartTextarea
              label="Нотатки" value={form.private_notes} onChange={set('private_notes')} rows={4}
              hint="Бачить лише творець запису та майстри гри — інші гравці цей текст не побачать, навіть якщо запис публічний."
              placeholder="Таємні мотиви, GM-нотатки для сюжету..."
            />
          </FormSection>
        )}

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
