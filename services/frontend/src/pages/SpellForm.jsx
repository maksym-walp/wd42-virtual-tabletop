import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import api from '../api/client';
import spellbookApi from '../api/spellbook';
import equipmentApi from '../api/equipment';
import traditionsApi from '../api/traditions';
import npcsApi from '../api/npcs';
import {
  RITUAL_TYPES, DURATION_UNITS,
  ACTION_OPTIONS, SPELL_COMPLEXITIES, DAMAGE_DICE, MAX_DAMAGE_DICE_COUNT, FORM_FIELDS, pickFormFields,
} from '../constants/spellbook';
import { COLLECTION_DOMAINS } from '../collectionsDomains';
import { useAuth } from '../context/AuthContext';
import Field, { inputClass } from '../components/ui/Field';
import SmartTextarea from '../components/ui/SmartTextarea';
import ImageUploadField from '../components/ui/ImageUploadField';
import Button from '../components/ui/Button';
import CollectionMembershipPicker from '../components/CollectionMembershipPicker';
import KindSwitch from '../components/KindSwitch';
import SpellComponentsField from '../components/SpellComponentsField';
import RelatedEntryPicker from '../components/RelatedEntryPicker';
import {
  componentsToState, cloneComponentRows, createMissingComponentItems, serializeComponentRows,
} from '../utils/componentRows';
import AuthorField from '../components/AuthorField';
import useSpellKinds from '../hooks/useSpellKinds';
import useMagicForms from '../hooks/useMagicForms';
import Tooltip from '../components/ui/Tooltip';
import useEntryForms from '../hooks/useEntryForms';
import EntryFormsSection from '../components/EntryFormsSection';

const domain = COLLECTION_DOMAINS.spellbook;

const EMPTY = {
  name: '', nature: ['arcana'], spell_kind: 'utility', complexity: 'simple',
  mechanical_desc: '', narrative_desc: '', lore_creator: '', lore_creator_npc_id: null,
  energy_cost: 0, action_time: 1, ritual: 'impossible',
  duration_value: '', duration_unit: 'instant', range_desc: '', damage_die: '', damage_dice_count: 1,
  components: [], is_public: true, is_canonical: true,
  image_url: '', image_crop: null,
  collectionIds: [],
  traditionIds: [],
  // Додаткові рівневі форми — { kind, id } + повні знімки FORM_FIELDS;
  // основна форма — це поля вище.
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
    damage_die: src.damage_die || '',
    damage_dice_count: src.damage_dice_count || 1,
    components: componentsToState(src.components),
  };
}

// Нова форма починається як копія основної — зазвичай форми відрізняються
// лише кількома полями. Рядки компонентів отримують нові key, щоб форми не
// ділили стан рядка. kind — завжди 'primitive' чи 'perfected' (id = kind).
function newForm(kind, source) {
  return {
    ...pickFormFields(source),
    kind,
    id: kind,
    components: cloneComponentRows(source.components),
  };
}

export default function SpellForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const canManageCanonical = user?.role === 'admin' || user?.role === 'game_master';
  const { spellKinds } = useSpellKinds();
  const { magicForms } = useMagicForms();
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
  const [related, setRelated] = useState([]);
  const initialRelatedIds = useRef([]);
  // Активна рівнева форма (вкладка на мобільному — на десктопі всі наявні
  // форми показуються поряд).
  const formsEditor = useEntryForms({ form, setForm, fields: FORM_FIELDS, newForm });
  const { allForms, activeEntry, current, patchForm, patchFormAt } = formsEditor;

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
          damage_die: s.damage_die || '', damage_dice_count: s.damage_dice_count || 1,
          components: componentsToState(s.components),
          is_public: s.is_public,
          image_url: s.image_url || '', image_crop: s.image_crop || null,
          traditionIds,
          forms: (s.forms || []).map(formToState),
        }));
      })
      .catch(() => navigate('/spellbook'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!isEdit) return;
    spellbookApi.getRelated(id)
      .then((list) => {
        initialRelatedIds.current = list.map((r) => r.id);
        setRelated(list);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!isEdit || membershipInitialized.current || loading || !collectionsLoaded) return;
    const memberIds = collections.filter((c) => (c.items || []).some((it) => it.id === id)).map((c) => c.id);
    initialCollectionIds.current = memberIds;
    setForm((f) => ({ ...f, collectionIds: memberIds }));
    membershipInitialized.current = true;
  }, [isEdit, loading, collectionsLoaded, collections, id]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

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

  const reconcileRelated = async (spellId) => {
    const before = initialRelatedIds.current;
    const after = related.map((r) => r.id);
    const toAdd = after.filter((rid) => !before.includes(rid));
    const toRemove = before.filter((rid) => !after.includes(rid));
    await Promise.all([
      ...toAdd.map((rid) => spellbookApi.addRelated(spellId, rid)),
      ...toRemove.map((rid) => spellbookApi.removeRelated(spellId, rid)),
    ]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Вкажи назву заклинання'); return; }
    setSaving(true);
    setError('');
    try {
      const createdIds = await createMissingComponentItems([form, ...form.forms].map((l) => l.components));

      const serializeForm = (src) => ({
        ...pickFormFields(src),
        complexity: src.complexity || null,
        components: serializeComponentRows(src.components, createdIds),
        duration_value: src.duration_value === '' ? null : Number(src.duration_value),
        energy_cost: Number(src.energy_cost),
        action_time: Number(src.action_time),
        damage_die: src.damage_die || null,
        damage_dice_count: Number(src.damage_dice_count) || 1,
      });

      const { collectionIds, traditionIds, forms, ...rest } = form;
      const payload = {
        ...rest,
        ...serializeForm(form),
        forms: forms.map((f) => ({ ...serializeForm(f), kind: f.kind, id: f.id })),
        image_url: form.image_url || null,
        image_crop: form.image_url ? (form.image_crop || null) : null,
      };
      if (isEdit) {
        await api.put(`/api/spellbook/${id}`, payload);
        await reconcileCollections(id);
        await reconcileTraditions(id);
        await reconcileRelated(id);
        navigate(`/spellbook/${id}`);
      } else {
        const { data } = await api.post('/api/spellbook/', payload);
        await reconcileCollections(data.spell.id);
        await reconcileTraditions(data.spell.id);
        await reconcileRelated(data.spell.id);
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

  // Поля "Механіка"+"Описи" для ОДНІЄЇ форми — викликається раз на
  // мобільному (для активної вкладки) і раз на колонку в десктопній сітці.
  const renderFormFields = (entry, patch) => (
    <>
      <Field label="Складність" className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(SPELL_COMPLEXITIES).map(([key, { label }]) => (
            <button
              key={key} type="button"
              onClick={() => patch({ complexity: entry.complexity === key ? '' : key })}
              className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
                entry.complexity === key ? 'border-gold bg-gold/10 text-gold' : 'border-border text-text-dim'
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
              onClick={() => patch({ spell_kind: key })}
              className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
                entry.spell_kind === key ? 'border-gold bg-gold/10 text-gold' : 'border-border text-text-dim'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Магічна енергія">
          <input type="number" min={0} className={inputClass} value={entry.energy_cost} onChange={(e) => patch({ energy_cost: Number(e.target.value) })} />
        </Field>
        <Field label="Час виконання">
          <select className={inputClass} value={entry.action_time} onChange={(e) => patch({ action_time: Number(e.target.value) })}>
            {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Ритуал">
          <select className={inputClass} value={entry.ritual} onChange={(e) => patch({ ritual: e.target.value })}>
            {Object.entries(RITUAL_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Тривалість">
          <div className="flex gap-2">
            {entry.duration_unit !== 'instant' && entry.duration_unit !== 'permanent' && (
              <input
                type="number" min={1} className={`${inputClass} !w-20 shrink-0`} value={entry.duration_value}
                onChange={(e) => patch({ duration_value: e.target.value })}
              />
            )}
            <select className={`${inputClass} min-w-0 flex-1`} value={entry.duration_unit} onChange={(e) => patch({ duration_unit: e.target.value })}>
              {Object.entries(DURATION_UNITS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </Field>
        <Field label="Дальність">
          <input
            type="text" className={inputClass} value={entry.range_desc} onChange={(e) => patch({ range_desc: e.target.value })}
            placeholder="напр. Дотик, 10 метрів, Себе..." maxLength={200}
          />
        </Field>
      </div>

      {entry.spell_kind === 'combat' && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Кубик шкоди">
            <select className={inputClass} value={entry.damage_die} onChange={(e) => patch({ damage_die: e.target.value })}>
              <option value="">Без шкоди</option>
              {DAMAGE_DICE.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          {entry.damage_die && (
            <Field label="Кількість кубиків" hint="Задається тут, не з Майстерності персонажа — вона стосується лише атак зброєю">
              <input
                type="number" min={1} max={MAX_DAMAGE_DICE_COUNT} className={inputClass}
                value={entry.damage_dice_count} onChange={(e) => patch({ damage_dice_count: Number(e.target.value) || 1 })}
              />
            </Field>
          )}
        </div>
      )}

      <Field label="Компоненти" className="mb-4">
        <SpellComponentsField
          components={entry.components}
          onChange={(next) => patch({ components: next })}
          equipmentItems={equipmentItems}
        />
      </Field>

      <SmartTextarea
        label="Механічний опис" className="mb-4"
        value={entry.mechanical_desc} onChange={(e) => patch({ mechanical_desc: e.target.value })}
        rows={4}
        placeholder="Що відбувається механічно: кидки, шкода, ефекти..."
      />
      <SmartTextarea
        label="Наративний опис" className="mb-4"
        value={entry.narrative_desc} onChange={(e) => patch({ narrative_desc: e.target.value })}
        rows={3}
        placeholder="Як це виглядає та відчувається у світі гри..."
      />
      <AuthorField
        name={entry.lore_creator}
        npcId={entry.lore_creator_npc_id}
        onChange={({ name, npc_id }) => patch({ lore_creator: name, lore_creator_npc_id: npc_id })}
        npcs={npcs}
        label="Творець"
        hint="Лорне поле — вкажи ім'я персонажа з бестіарію або впиши довільне (напр. ім'я архімага, що винайшов це заклинання)"
      />
    </>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6 md:pb-8 lg:max-w-6xl">
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

          <Field label="Форма магії" hint="Можна обрати декілька" className="mb-4">
            <div className="flex flex-wrap gap-1.5">
              {magicForms.map(({ key, label, description }) => (
                <Tooltip key={key} text={description}>
                  <button
                    type="button"
                    onClick={() => toggleNature(key)}
                    className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
                      form.nature.includes(key) ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border text-text-dim'
                    }`}
                  >
                    {label}
                  </button>
                </Tooltip>
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
          <EntryFormsSection forms={formsEditor} fieldsHint="Механіка й описи нижче" />
        </FormSection>

        {/* — Механіка та опис: на мобільному — одна активна форма, на десктопі — усі поряд — */}
        <FormSection title={allForms.length > 1 ? `Механіка та опис · ${activeEntry.label}` : 'Механіка та опис'}>
          <div className="lg:hidden">{renderFormFields(current, patchForm)}</div>
          {allForms.length > 1 ? (
            <div className={`hidden gap-6 lg:grid ${allForms.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
              {allForms.map((f) => (
                <div key={f.key} className="min-w-0">
                  <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
                    <span className="text-sm font-bold text-accent">{f.label}</span>
                    {f.key !== 'main' && (
                      <button
                        type="button"
                        onClick={() => formsEditor.removeForm(f.key, f.label)}
                        className="text-xs text-text-dim hover:text-danger"
                      >
                        Видалити
                      </button>
                    )}
                  </div>
                  {renderFormFields(f, (patch) => patchFormAt(f.key, patch))}
                </div>
              ))}
            </div>
          ) : (
            <div className="hidden lg:block">{renderFormFields(current, patchForm)}</div>
          )}
        </FormSection>

        {/* — Рівноцінні / альтернативні — */}
        <FormSection title="Рівноцінні / альтернативні">
          <RelatedEntryPicker
            serviceKey="spellbook"
            excludeId={id}
            value={related}
            onChange={setRelated}
            label="Додати заклинання"
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
