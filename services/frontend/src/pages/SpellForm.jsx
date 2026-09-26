import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Plus, Trash2 } from 'lucide-react';
import api from '../api/client';
import skillTreeApi from '../api/skillTree';
import equipmentApi from '../api/equipment';
import traditionsApi from '../api/traditions';
import spellbookApi from '../api/spellbook';
import compendiumApi from '../api/compendium';
import {
  NATURE_TYPES, RITUAL_TYPES, DURATION_UNITS,
  ACTION_OPTIONS, SPELL_KINDS, SPELL_COMPLEXITIES, pickLevelFields,
} from '../constants/spellbook';
import { COLLECTION_DOMAINS } from '../collectionsDomains';
import { useAuth } from '../context/AuthContext';
import Field, { inputClass } from '../components/ui/Field';
import SmartTextarea from '../components/ui/SmartTextarea';
import ImageUploadField from '../components/ui/ImageUploadField';
import Button from '../components/ui/Button';
import NodePrerequisitePicker from '../components/NodePrerequisitePicker';
import CollectionMembershipPicker from '../components/CollectionMembershipPicker';
import KindSwitch from '../components/KindSwitch';
import SpellComponentsField, { emptyComponentRow } from '../components/SpellComponentsField';
import AuthorField from '../components/AuthorField';
import SpellPickerField from '../components/SpellPickerField';

const domain = COLLECTION_DOMAINS.spellbook;

const EMPTY = {
  name: '', nature: ['arcana'], spell_kind: 'utility', complexity: 'simple',
  mechanical_desc: '', narrative_desc: '', lore_creator: '', lore_creator_npc_id: null,
  energy_cost: 0, action_time: 1, ritual: 'impossible',
  duration_value: '', duration_unit: 'instant', range_desc: '',
  components: [], is_public: true,
  prerequisite_node_ids: [], prerequisite_logic: 'or',
  image_url: '',
  collectionIds: [],
  traditionIds: [],
  // «Потрібно вивчити» — одне батьківське заклинання; «Похідні» — ті, чий
  // parent_spell_id вказує сюди (сервер змінює лише власні похідні).
  parent_spell_id: null,
  derivedIds: [],
  // Рівні 2..N — повні знімки LEVEL_FIELDS; рівень 1 — це поля вище.
  levels: [],
};

// Серверний рівень → стан форми (ті самі перетворення, що й для рівня 1
// при завантаженні: '' замість null для інпутів, рядки компонентів з key).
function levelToForm(level) {
  return {
    ...level,
    complexity: level.complexity ?? '',
    mechanical_desc: level.mechanical_desc || '',
    narrative_desc: level.narrative_desc || '',
    lore_creator: level.lore_creator || '',
    lore_creator_npc_id: level.lore_creator_npc_id ?? null,
    duration_value: level.duration_value ?? '',
    range_desc: level.range_desc || '',
    components: (level.components || []).map((c) => ({ ...emptyComponentRow(), ...c })),
  };
}

// Новий рівень починається як копія попереднього — зазвичай наступна версія
// заклинання відрізняється лише кількома полями. Рядки компонентів
// отримують нові key, щоб рівні не ділили стан рядка.
function copyLevel(level) {
  return {
    ...pickLevelFields(level),
    components: level.components.map((c) => ({ ...c, key: emptyComponentRow().key })),
  };
}

export default function SpellForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const canManageTraditions = user?.role === 'admin' || user?.role === 'game_master';
  const kinds = domain.kindSwitch.filter((k) => k.key !== 'tradition' || canManageTraditions);

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [nodes, setNodes] = useState([]);
  const [equipmentItems, setEquipmentItems] = useState([]);
  const [collections, setCollections] = useState([]);
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);
  const initialCollectionIds = useRef([]);
  const membershipInitialized = useRef(false);
  const [traditions, setTraditions] = useState([]);
  const initialTraditionIds = useRef([]);
  const [npcs, setNpcs] = useState([]);
  const [allSpells, setAllSpells] = useState([]);
  // Похідні, які вже прив'язані на момент завантаження (з назвами — навіть
  // якщо їх немає в allSpells) і які не можна відчепити (чужі).
  const [loadedDerived, setLoadedDerived] = useState([]);
  // 0 = рівень 1 (поля самого form), i > 0 = form.levels[i - 1].
  const [activeLevel, setActiveLevel] = useState(0);

  useEffect(() => {
    skillTreeApi.getNodes({ archetype: 'spellcaster' }).then(setNodes).catch(() => {});
  }, []);

  useEffect(() => {
    compendiumApi.listEntries('npc').then(setNpcs).catch(() => {});
  }, []);

  useEffect(() => {
    equipmentApi.getAll().then(setEquipmentItems).catch(() => {});
  }, []);

  useEffect(() => {
    traditionsApi.getAll().then(setTraditions).catch(() => {});
  }, []);

  useEffect(() => {
    spellbookApi.getAll().then(setAllSpells).catch(() => {});
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
          prerequisite_node_ids: s.prerequisite_node_ids || [],
          prerequisite_logic: s.prerequisite_logic || 'or',
          image_url: s.image_url || '',
          traditionIds,
          levels: (s.levels || []).map(levelToForm),
          parent_spell_id: s.parent_spell_id ?? null,
          derivedIds: (s.derived_spells || []).map((d) => d.id),
        }));
        setLoadedDerived(s.derived_spells || []);
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

  // Поля, що відрізняються між рівнями, читаються й пишуться через активний рівень.
  const current = activeLevel === 0 ? form : form.levels[activeLevel - 1];
  const patchLevel = (patch) => setForm((f) => (activeLevel === 0
    ? { ...f, ...patch }
    : { ...f, levels: f.levels.map((l, i) => (i === activeLevel - 1 ? { ...l, ...patch } : l)) }));
  const setL = (field) => (e) => patchLevel({ [field]: e.target.value });
  const setLNum = (field) => (e) => patchLevel({ [field]: Number(e.target.value) });

  const addLevel = () => {
    const last = form.levels.length ? form.levels[form.levels.length - 1] : form;
    setForm((f) => ({ ...f, levels: [...f.levels, copyLevel(last)] }));
    setActiveLevel(form.levels.length + 1);
  };

  const removeActiveLevel = () => {
    if (activeLevel === 0) return;
    if (!confirm(`Видалити рівень ${activeLevel + 1}?`)) return;
    setForm((f) => ({ ...f, levels: f.levels.filter((_, i) => i !== activeLevel - 1) }));
    setActiveLevel((lvl) => lvl - 1);
  };

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
      // новий предмет (за назвою) створюється лише раз на всі рівні.
      const allComponents = [form, ...form.levels].flatMap((l) => l.components);
      const namesToCreate = [...new Set(
        allComponents
          .filter((c) => c.createAsNew && !c.item_id && c.name.trim())
          .map((c) => c.name.trim())
      )];
      const created = await Promise.all(
        namesToCreate.map((name) => equipmentApi.create({ name }).then((item) => [name.toLowerCase(), item.id]))
      );
      const createdIds = Object.fromEntries(created);

      const serializeLevel = (level) => ({
        ...pickLevelFields(level),
        complexity: level.complexity || null,
        components: level.components
          .filter((c) => c.name.trim() !== '')
          .map((c) => ({
            item_id: c.item_id ?? (c.createAsNew ? createdIds[c.name.trim().toLowerCase()] : null) ?? null,
            name: c.name.trim(),
            quantity: c.quantity || 1,
            unit: c.unit || '',
          })),
        duration_value: level.duration_value === '' ? null : Number(level.duration_value),
        energy_cost: Number(level.energy_cost),
        action_time: Number(level.action_time),
      });

      const { collectionIds, traditionIds, levels, derivedIds, ...rest } = form;
      const payload = {
        ...rest,
        parent_spell_id: form.parent_spell_id || null,
        derived_spell_ids: derivedIds,
        ...serializeLevel(form),
        levels: levels.map(serializeLevel),
        image_url: form.image_url || null,
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

  const isAdmin = user?.role === 'admin';
  const spellNameById = new Map(allSpells.map((sp) => [sp.id, sp.name]));
  const parentOptions = allSpells.filter((sp) => sp.id !== id && !form.derivedIds.includes(sp.id));
  const lockedDerivedIds = isAdmin ? [] : loadedDerived.filter((d) => !d.is_owner).map((d) => d.id);
  // Похідним можна зробити лише власне заклинання (сервер пише рядок похідного).
  const derivedOptions = [
    ...allSpells.filter((sp) => (sp.is_owner || isAdmin) && sp.id !== id && sp.id !== form.parent_spell_id),
    ...loadedDerived.filter((d) => !allSpells.some((sp) => sp.id === d.id)),
  ];
  const describeCurrentParent = (sp) => (sp.parent_spell_id && sp.parent_spell_id !== id
    ? `зараз походить від «${spellNameById.get(sp.parent_spell_id) ?? '…'}»`
    : null);

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
            entityType="item"
          />
        </FormSection>

        {/* — Рівні — */}
        <FormSection title="Рівні">
          <p className="mb-3 text-xs text-text-dim">
            Рівні — різні версії розвитку одного заклинання. Механіка й описи нижче редагуються для обраного рівня;
            новий рівень починається як копія попереднього.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {[form, ...form.levels].map((_, i) => (
              <button
                key={i} type="button"
                onClick={() => setActiveLevel(i)}
                className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  activeLevel === i ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-dim'
                }`}
              >
                Рівень {i + 1}
              </button>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={addLevel}>
              <Plus size={14} /> Додати рівень
            </Button>
            {activeLevel > 0 && (
              <Button type="button" variant="danger" size="sm" onClick={removeActiveLevel}>
                <Trash2 size={14} /> Видалити рівень {activeLevel + 1}
              </Button>
            )}
          </div>
        </FormSection>

        {/* — Механіка — */}
        <FormSection title={form.levels.length ? `Механіка · Рівень ${activeLevel + 1}` : 'Механіка'}>
          <Field label="Складність" className="mb-4">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SPELL_COMPLEXITIES).map(([key, { label }]) => (
                <button
                  key={key} type="button"
                  onClick={() => patchLevel({ complexity: current.complexity === key ? '' : key })}
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
              {Object.entries(SPELL_KINDS).map(([key, { label }]) => (
                <button
                  key={key} type="button"
                  onClick={() => patchLevel({ spell_kind: key })}
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
              key={activeLevel}
              components={current.components}
              onChange={(next) => patchLevel({ components: next })}
              equipmentItems={equipmentItems}
            />
          </Field>
        </FormSection>

        {/* — Описи — */}
        <FormSection title={form.levels.length ? `Описи · Рівень ${activeLevel + 1}` : 'Описи'}>
          <SmartTextarea
            key={`${activeLevel}-mech`}
            label="Механічний опис" className="mb-4"
            value={current.mechanical_desc} onChange={setL('mechanical_desc')}
            rows={4}
            placeholder="Що відбувається механічно: кидки, шкода, ефекти..."
          />
          <SmartTextarea
            key={`${activeLevel}-narr`}
            label="Наративний опис" className="mb-4"
            value={current.narrative_desc} onChange={setL('narrative_desc')}
            rows={3}
            placeholder="Як це виглядає та відчувається у світі гри..."
          />
          <AuthorField
            key={activeLevel}
            name={current.lore_creator}
            npcId={current.lore_creator_npc_id}
            onChange={({ name, npc_id }) => patchLevel({ lore_creator: name, lore_creator_npc_id: npc_id })}
            npcs={npcs}
            label="Творець"
            hint="Лорне поле — вкажи ім'я персонажа з бестіарію або впиши довільне (напр. ім'я архімага, що винайшов це заклинання)"
          />
        </FormSection>

        {/* — Дерево заклинань — */}
        <FormSection title="Дерево заклинань">
          <PickerBlock label="Потрібно вивчити" hint="Заклинання, з якого походить це (не більше одного)" className="mb-4">
            <SpellPickerField
              single
              options={parentOptions}
              value={form.parent_spell_id ? [form.parent_spell_id] : []}
              onChange={(ids) => setForm((f) => ({ ...f, parent_spell_id: ids[0] ?? null }))}
            />
          </PickerBlock>
          <PickerBlock label="Похідні заклинання" hint="Можна обрати декілька; лише власні заклинання">
            <SpellPickerField
              options={derivedOptions}
              value={form.derivedIds}
              lockedIds={lockedDerivedIds}
              onChange={(ids) => setForm((f) => ({ ...f, derivedIds: ids }))}
              describe={describeCurrentParent}
            />
          </PickerBlock>
        </FormSection>

        {/* — Вимоги дерева розвитку — */}
        <FormSection title="Вимоги дерева розвитку" collapsible defaultOpen={false}>
          <NodePrerequisitePicker
            nodes={nodes}
            value={form}
            onChange={(next) => setForm((f) => ({ ...f, ...next }))}
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

// Як Field, але <div> замість <label>: усередині кілька кнопок (чіпи з
// «прибрати», підказки), і клік по тексту label активував би першу з них.
function PickerBlock({ label, hint, className = '', children }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">{label}</span>
      {children}
      {hint && <span className="text-xs text-text-dim">{hint}</span>}
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
