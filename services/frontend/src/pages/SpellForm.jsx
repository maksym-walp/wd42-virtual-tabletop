import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import api from '../api/client';
import equipmentApi from '../api/equipment';
import traditionsApi from '../api/traditions';
import npcsApi from '../api/npcs';
import {
  NATURE_TYPES, RITUAL_TYPES, DURATION_UNITS,
  ACTION_OPTIONS, SPELL_COMPLEXITIES, FORM_FIELDS, pickFormFields, spellFormMode,
} from '../constants/spellbook';
import { COLLECTION_DOMAINS } from '../collectionsDomains';
import { useAuth } from '../context/AuthContext';
import Field, { inputClass } from '../components/ui/Field';
import SmartTextarea from '../components/ui/SmartTextarea';
import ImageUploadField from '../components/ui/ImageUploadField';
import Button from '../components/ui/Button';
import CollectionMembershipPicker from '../components/CollectionMembershipPicker';
import KindSwitch from '../components/KindSwitch';
import SpellComponentsField, { emptyComponentRow } from '../components/SpellComponentsField';
import AuthorField from '../components/AuthorField';
import useSpellKinds from '../hooks/useSpellKinds';
import useEntryForms, { newAlternativeFormId } from '../hooks/useEntryForms';
import EntryFormsSection from '../components/EntryFormsSection';

const domain = COLLECTION_DOMAINS.spellbook;

const EMPTY = {
  name: '', nature: ['arcana'], spell_kind: 'utility', complexity: 'simple',
  mechanical_desc: '', narrative_desc: '', lore_creator: '', lore_creator_npc_id: null,
  energy_cost: 0, action_time: 1, ritual: 'impossible',
  duration_value: '', duration_unit: 'instant', range_desc: '',
  components: [], is_public: true, is_canonical: true,
  image_url: '', image_crop: null,
  collectionIds: [],
  traditionIds: [],
  // Додаткові форми — { kind, id, name } + повні знімки FORM_FIELDS;
  // основна форма — це поля вище (main_form_name — її назва, лише для
  // заклинань з альтернативними формами).
  main_form_name: '',
  forms: [],
};

// Серверна форма → стан редактора (ті самі перетворення, що й для основної
// при завантаженні: '' замість null для інпутів, рядки компонентів з key).
function formToState(src) {
  return {
    ...src,
    complexity: src.complexity ?? '',
    mechanical_desc: src.mechanical_desc || '',
    narrative_desc: src.narrative_desc || '',
    lore_creator: src.lore_creator || '',
    lore_creator_npc_id: src.lore_creator_npc_id ?? null,
    duration_value: src.duration_value ?? '',
    range_desc: src.range_desc || '',
    components: (src.components || []).map((c) => ({ ...emptyComponentRow(), ...c })),
  };
}

// Нова форма починається як копія основної — зазвичай форми відрізняються
// лише кількома полями. Рядки компонентів отримують нові key, щоб форми не
// ділили стан рядка. Альтернативна отримує uuid одразу: сервер його
// зберігає, і на нього посилається лист персонажа.
function newForm(kind, source) {
  return {
    ...pickFormFields(source),
    kind,
    id: kind === 'alternative' ? newAlternativeFormId() : kind,
    name: kind === 'alternative' ? 'Нова форма' : null,
    components: source.components.map((c) => ({ ...c, key: emptyComponentRow().key })),
  };
}

export default function SpellForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const canManageCanonical = user?.role === 'admin' || user?.role === 'game_master';
  const { spellKinds } = useSpellKinds();
  const canManageTraditions = user?.role === 'admin' || user?.role === 'game_master';
  const kinds = domain.kindSwitch.filter((k) => k.key !== 'tradition' || canManageTraditions);

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [equipmentItems, setEquipmentItems] = useState([]);
  const [collections, setCollections] = useState([]);
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);
  const initialCollectionIds = useRef([]);
  const membershipInitialized = useRef(false);
  const [traditions, setTraditions] = useState([]);
  const initialTraditionIds = useRef([]);
  const [npcs, setNpcs] = useState([]);
  // Активна форма й тип форм (основна + альтернативні або рівневі).
  const formsEditor = useEntryForms({ form, setForm, fields: FORM_FIELDS, newForm });
  const { activeEntry, current, patchForm, setFormMode } = formsEditor;

  useEffect(() => {
    npcsApi.list().then(setNpcs).catch(() => {});
  }, []);

  useEffect(() => {
    equipmentApi.getAll().then(setEquipmentItems).catch(() => {});
  }, []);

  useEffect(() => {
    traditionsApi.getAll().then(setTraditions).catch(() => {});
  }, []);

  useEffect(() => {
    domain.collectionsApi.getAll()
      .then((all) => setCollections(all.filter((c) => c.is_owner)))
      .catch(() => {})
      .finally(() => setCollectionsLoaded(true));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/api/spellbook/${id}`)
      .then(({ data }) => {
        const s = data.spell;
        const traditionIds = (s.traditions || []).map((t) => t.id);
        initialTraditionIds.current = traditionIds;
        setForm((f) => ({
          ...f,
          name: s.name, nature: s.nature || [], spell_kind: s.spell_kind || 'utility',
          complexity: s.complexity ?? '',
          mechanical_desc: s.mechanical_desc || '',
          narrative_desc: s.narrative_desc || '',
          lore_creator: s.lore_creator || '',
          lore_creator_npc_id: s.lore_creator_npc_id ?? null,
          energy_cost: s.energy_cost, action_time: s.action_time,
          ritual: s.ritual, duration_value: s.duration_value ?? '',
          duration_unit: s.duration_unit, range_desc: s.range_desc || '',
          components: (s.components || []).map((c) => ({ ...emptyComponentRow(), ...c })),
          is_public: s.is_public,
          image_url: s.image_url || '', image_crop: s.image_crop || null,
          traditionIds,
          main_form_name: s.main_form_name || '',
          forms: (s.forms || []).map(formToState),
        }));
        setFormMode(spellFormMode(s));
      })
      .catch(() => navigate('/spellbook'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!isEdit || membershipInitialized.current || loading || !collectionsLoaded) return;
    const memberIds = collections.filter((c) => (c.items || []).some((it) => it.id === id)).map((c) => c.id);
    initialCollectionIds.current = memberIds;
    setForm((f) => ({ ...f, collectionIds: memberIds }));
    membershipInitialized.current = true;
  }, [isEdit, loading, collectionsLoaded, collections, id]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Поля, що відрізняються між формами, читаються й пишуться через активну форму.
  const setL = (field) => (e) => patchForm({ [field]: e.target.value });
  const setLNum = (field) => (e) => patchForm({ [field]: Number(e.target.value) });

  const reconcileCollections = async (itemId) => {
    const before = initialCollectionIds.current;
    const after = form.collectionIds;
    const toAdd = after.filter((cid) => !before.includes(cid));
    const toRemove = before.filter((cid) => !after.includes(cid));
    await Promise.all([
      ...toAdd.map((cid) => domain.collectionsApi.addItem(cid, domain.itemIdField, itemId)),
      ...toRemove.map((cid) => domain.collectionsApi.removeItem(cid, itemId)),
    ]);
  };

  const reconcileTraditions = async (spellId) => {
    const before = initialTraditionIds.current;
    const after = form.traditionIds;
    const toAdd = after.filter((tid) => !before.includes(tid));
    const toRemove = before.filter((tid) => !after.includes(tid));
    await Promise.all([
      ...toAdd.map((tid) => traditionsApi.addSpell(tid, spellId)),
      ...toRemove.map((tid) => traditionsApi.removeSpell(tid, spellId)),
    ]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Вкажи назву заклинання'); return; }
    setSaving(true);
    setError('');
    try {
      // Quick-create flow: any component row flagged "create as new item"
      // that isn't already linked to an equipment item gets created first,
      // always public — never as the author's private item.
      // Рівні часто повторюють ті самі компоненти, тож один і той самий
      // новий предмет (за назвою) створюється лише раз на всі форми.
      const allComponents = [form, ...form.forms].flatMap((l) => l.components);
      const namesToCreate = [...new Set(
        allComponents
          .filter((c) => c.createAsNew && !c.item_id && c.name.trim())
          .map((c) => c.name.trim())
      )];
      const created = await Promise.all(
        namesToCreate.map((name) => equipmentApi.create({ name }).then((item) => [name.toLowerCase(), item.id]))
      );
      const createdIds = Object.fromEntries(created);

      const serializeForm = (src) => ({
        ...pickFormFields(src),
        complexity: src.complexity || null,
        components: src.components
          .filter((c) => c.name.trim() !== '')
          .map((c) => ({
            item_id: c.item_id ?? (c.createAsNew ? createdIds[c.name.trim().toLowerCase()] : null) ?? null,
            name: c.name.trim(),
            quantity: c.quantity || 1,
            unit: c.unit || '',
          })),
        duration_value: src.duration_value === '' ? null : Number(src.duration_value),
        energy_cost: Number(src.energy_cost),
        action_time: Number(src.action_time),
      });

      const { collectionIds, traditionIds, forms, ...rest } = form;
      const payload = {
        ...rest,
        ...serializeForm(form),
        forms: forms.map((f) => ({ ...serializeForm(f), kind: f.kind, id: f.id, name: f.name })),
        image_url: form.image_url || null,
        image_crop: form.image_url ? (form.image_crop || null) : null,
      };
      if (isEdit) {
        await api.put(`/api/spellbook/${id}`, payload);
        await reconcileCollections(id);
        await reconcileTraditions(id);
        navigate(`/spellbook/${id}`);
      } else {
        const { data } = await api.post('/api/spellbook/', payload);
        await reconcileCollections(data.spell.id);
        await reconcileTraditions(data.spell.id);
        navigate(`/spellbook/${data.spell.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  const toggleNature = (key) => setForm((f) => ({
    ...f,
    nature: f.nature.includes(key) ? f.nature.filter((n) => n !== key) : [...f.nature, key],
  }));
  const toggleTradition = (tid) => setForm((f) => ({
    ...f,
    traditionIds: f.traditionIds.includes(tid) ? f.traditionIds.filter((x) => x !== tid) : [...f.traditionIds, tid],
  }));

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
        <FormSection title="Загальне">
          <Field label="Тип" className="mb-4">
            <KindSwitch kinds={kinds} active="spell" />
          </Field>

          <Field label="Назва заклинання" className="mb-4">
            <input type="text" className={inputClass} value={form.name} onChange={set('name')} required maxLength={200} />
          </Field>

          <Field label="Природа заклинання" hint="Можна обрати декілька" className="mb-4">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(NATURE_TYPES).map(([key, { label }]) => (
                <button
                  key={key} type="button"
                  onClick={() => toggleNature(key)}
                  className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    form.nature.includes(key) ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border text-text-dim'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Магічна традиція" hint="Можна обрати декілька" className="mb-4">
            {traditions.length === 0 ? (
              <p className="text-sm text-text-dim">Ще немає жодної традиції.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {traditions.map((t) => (
                  <button
                    key={t.id} type="button"
                    onClick={() => toggleTradition(t.id)}
                    className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
                      form.traditionIds.includes(t.id)
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border text-text-dim'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </Field>

          <ImageUploadField
            value={form.image_url}
            onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
            crop={form.image_crop}
            onCropChange={(crop) => setForm((f) => ({ ...f, image_crop: crop }))}
            entityType="item"
          />
        </FormSection>

        {/* — Форми — */}
        <FormSection title="Форми">
          <EntryFormsSection
            forms={formsEditor}
            mainFormName={form.main_form_name}
            onMainFormNameChange={set('main_form_name')}
            fieldsHint="Механіка й описи нижче"
            altNamePlaceholder="напр. Крижана форма"
          />
        </FormSection>

        {/* — Механіка — */}
        <FormSection title={form.forms.length ? `Механіка · ${activeEntry.label}` : 'Механіка'}>
          <Field label="Складність" className="mb-4">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SPELL_COMPLEXITIES).map(([key, { label }]) => (
                <button
                  key={key} type="button"
                  onClick={() => patchForm({ complexity: current.complexity === key ? '' : key })}
                  className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    current.complexity === key
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-border text-text-dim'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Вид заклинання" className="mb-4">
            <div className="flex flex-wrap gap-1.5">
              {spellKinds.map(({ key, label }) => (
                <button
                  key={key} type="button"
                  onClick={() => patchForm({ spell_kind: key })}
                  className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    current.spell_kind === key
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-border text-text-dim'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Магічна енергія">
              <input type="number" min={0} className={inputClass} value={current.energy_cost} onChange={setLNum('energy_cost')} />
            </Field>
            <Field label="Час виконання">
              <select className={inputClass} value={current.action_time} onChange={setLNum('action_time')}>
                {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Ритуал">
              <select className={inputClass} value={current.ritual} onChange={setL('ritual')}>
                {Object.entries(RITUAL_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Тривалість">
              <div className="flex gap-2">
                {current.duration_unit !== 'instant' && current.duration_unit !== 'permanent' && (
                  <input
                    type="number" min={1} className={`${inputClass} !w-20 shrink-0`} value={current.duration_value}
                    onChange={setL('duration_value')}
                  />
                )}
                <select className={`${inputClass} min-w-0 flex-1`} value={current.duration_unit} onChange={setL('duration_unit')}>
                  {Object.entries(DURATION_UNITS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </Field>
            <Field label="Дальність">
              <input
                type="text" className={inputClass} value={current.range_desc} onChange={setL('range_desc')}
                placeholder="напр. Дотик, 10 метрів, Себе..." maxLength={200}
              />
            </Field>
          </div>

          <Field label="Компоненти">
            <SpellComponentsField
              key={activeEntry.key}
              components={current.components}
              onChange={(next) => patchForm({ components: next })}
              equipmentItems={equipmentItems}
            />
          </Field>
        </FormSection>

        {/* — Описи — */}
        <FormSection title={form.forms.length ? `Описи · ${activeEntry.label}` : 'Описи'}>
          <SmartTextarea
            key={`${activeEntry.key}-mech`}
            label="Механічний опис" className="mb-4"
            value={current.mechanical_desc} onChange={setL('mechanical_desc')}
            rows={4}
            placeholder="Що відбувається механічно: кидки, шкода, ефекти..."
          />
          <SmartTextarea
            key={`${activeEntry.key}-narr`}
            label="Наративний опис" className="mb-4"
            value={current.narrative_desc} onChange={setL('narrative_desc')}
            rows={3}
            placeholder="Як це виглядає та відчувається у світі гри..."
          />
          <AuthorField
            key={activeEntry.key}
            name={current.lore_creator}
            npcId={current.lore_creator_npc_id}
            onChange={({ name, npc_id }) => patchForm({ lore_creator: name, lore_creator_npc_id: npc_id })}
            npcs={npcs}
            label="Творець"
            hint="Лорне поле — вкажи ім'я персонажа з бестіарію або впиши довільне (напр. ім'я архімага, що винайшов це заклинання)"
          />
        </FormSection>

        {/* — Колекції — */}
        <FormSection title="Колекції">
          <CollectionMembershipPicker
            collections={collections}
            basePath={domain.basePath}
            value={form.collectionIds}
            onChange={(ids) => setForm((f) => ({ ...f, collectionIds: ids }))}
          />
        </FormSection>

        {/* — Налаштування — */}
        <FormSection title="Налаштування">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
            <input
              type="checkbox" checked={form.is_public}
              onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
              className="h-5 w-5 accent-accent"
            />
            Публічне — видиме всім гравцям
          </label>
          {/* Лише при створенні — далі канонічність перемикається на сторінці запису. */}
          {!isEdit && canManageCanonical && (
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-text">
              <input
                type="checkbox" checked={form.is_canonical}
                onChange={(e) => setForm((f) => ({ ...f, is_canonical: e.target.checked }))}
                className="h-5 w-5 accent-accent"
              />
              Канонічне — офіційне заклинання світу
            </label>
          )}
        </FormSection>

        {error && <p className="text-sm text-danger">{error}</p>}

        {/* Sticky save bar — stays reachable by thumb on mobile, above BottomNav */}
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex justify-end gap-3 border-t border-border bg-surface px-4 py-3 md:static md:border-0 md:bg-transparent md:px-0 md:py-0">
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

function FormSection({ title, collapsible = false, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const showContent = !collapsible || open;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between border-b border-border bg-bg px-4 py-2"
        >
          <span className="text-xs font-bold uppercase tracking-wide text-text-dim">{title}</span>
          <ChevronDown size={16} className={`text-text-dim transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <div className="border-b border-border bg-bg px-4 py-2">
          <span className="text-xs font-bold uppercase tracking-wide text-text-dim">{title}</span>
        </div>
      )}
      {showContent && <div className="p-4">{children}</div>}
    </div>
  );
}
