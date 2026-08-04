import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import {
  EQUIPMENT_TYPES, EQUIPMENT_ENDPOINTS, EQUIPMENT_TYPE_PATHS, EQUIPMENT_NEW_LABELS, DAMAGE_DICE, WEAPON_MODIFIERS, ARMOR_WEIGHTS,
} from '../constants/equipment';
import { CHARACTERISTICS } from '../constants/characterSheet';
import { COLLECTION_DOMAINS } from '../collectionsDomains';
import useWeaponOptions from '../hooks/useWeaponOptions';
import Field, { inputClass } from '../components/ui/Field';
import SmartTextarea from '../components/ui/SmartTextarea';
import ImageUploadField from '../components/ui/ImageUploadField';
import MultiSelectDropdown from '../components/ui/MultiSelectDropdown';
import Button from '../components/ui/Button';
import CollectionMembershipPicker from '../components/CollectionMembershipPicker';
import KindSwitch from '../components/KindSwitch';

const domain = COLLECTION_DOMAINS.equipment;

const EMPTY = {
  name: '', type: 'weapon', damage_die: '', defense_value: '',
  description: '', is_public: true,
  price: '', image_url: '',
  weapon_type: '', weapon_grip: [], modifier: '',
  armor_weight: '',
  collectionIds: [],
};

export default function EquipmentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const { weaponTypes, weaponGrips } = useWeaponOptions();

  // Coming from a specific type tab (?type=armor from /equipment/armor's
  // "+ Новий предмет") preselects that type instead of always defaulting to
  // weapon — irrelevant once isEdit's own load overwrites it below.
  const [form, setForm] = useState(() => {
    const typeParam = searchParams.get('type');
    return EQUIPMENT_TYPES[typeParam] ? { ...EMPTY, type: typeParam } : EMPTY;
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [collections, setCollections] = useState([]);
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);
  const initialCollectionIds = useRef([]);
  const membershipInitialized = useRef(false);

  useEffect(() => {
    domain.collectionsApi.getAll()
      .then((all) => setCollections(all.filter((c) => c.is_owner)))
      .catch(() => {})
      .finally(() => setCollectionsLoaded(true));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/api/equipment/${id}`)
      .then(({ data }) => {
        const i = data.item;
        setForm((f) => ({
          ...f,
          name: i.name, type: i.type,
          damage_die: i.damage_die || '', defense_value: i.defense_value ?? '',
          description: i.description || '', is_public: i.is_public,
          price: i.price ?? '', image_url: i.image_url || '',
          weapon_type: i.weapon_type || '', weapon_grip: i.weapon_grip || [], modifier: i.modifier || '',
          armor_weight: i.armor_weight || '',
        }));
      })
      .catch(() => navigate('/equipment'))
      .finally(() => setLoading(false));
  }, [id]);

  // Membership can only be resolved once both the item (to know its id, in
  // edit mode) and the user's own collections (to check which contain it)
  // have loaded — runs once, then form.collectionIds is the source of truth.
  useEffect(() => {
    if (!isEdit || membershipInitialized.current || loading || !collectionsLoaded) return;
    const memberIds = collections.filter((c) => (c.items || []).some((it) => it.id === id)).map((c) => c.id);
    initialCollectionIds.current = memberIds;
    setForm((f) => ({ ...f, collectionIds: memberIds }));
    membershipInitialized.current = true;
  }, [isEdit, loading, collectionsLoaded, collections, id]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // "Інше" isn't a stored modifier value itself — it just reveals the
  // full-skill picker below. Once a non-preset skill is already saved
  // (edit mode), the picker should show without needing to pick it again.
  const [modifierOtherOpen, setModifierOtherOpen] = useState(false);
  const modifierIsOther = form.modifier !== '' && !WEAPON_MODIFIERS[form.modifier];
  const showModifierPicker = modifierIsOther || modifierOtherOpen;
  const modifierSelectValue = showModifierPicker ? 'other' : form.modifier;

  const handleModifierSelect = (e) => {
    const value = e.target.value;
    if (value === 'other') {
      setModifierOtherOpen(true);
      setForm((f) => (WEAPON_MODIFIERS[f.modifier] ? { ...f, modifier: '' } : f));
    } else {
      setModifierOtherOpen(false);
      setForm((f) => ({ ...f, modifier: value }));
    }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Вкажи назву предмета'); return; }
    setSaving(true);
    setError('');
    try {
      // Вид більше не поле запису, а вибір таблиці — тому він визначає
      // ендпоінт і в тілі запиту не потрібен. Поля чужого виду сервіс просто
      // не бере, тож надсилати їх усі безпечно.
      const { collectionIds, type, ...rest } = form;
      const base = EQUIPMENT_ENDPOINTS[type];
      const payload = {
        ...rest,
        damage_die: form.damage_die || null,
        defense_value: form.defense_value === '' ? null : Number(form.defense_value),
        price: form.price === '' ? null : Number(form.price),
        image_url: form.image_url || null,
        weapon_type: form.weapon_type || null,
        weapon_grip: form.weapon_grip.length ? form.weapon_grip : null,
        modifier: form.modifier || null,
        armor_weight: form.armor_weight || null,
      };
      if (isEdit) {
        // Якщо вид змінили, PUT іде на ендпоінт НОВОГО виду — сервіс переносить
        // рядок між таблицями, зберігаючи id, власника й місце в колекціях.
        await api.put(`${base}/${id}`, payload);
        await reconcileCollections(id);
        navigate(`/equipment/${id}`);
      } else {
        const { data } = await api.post(`${base}/`, payload);
        await reconcileCollections(data.item.id);
        navigate(`/equipment/${data.item.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  const activeType = EQUIPMENT_TYPES[form.type] || EQUIPMENT_TYPES.item;
  const typeCatalogHref = `/equipment/${EQUIPMENT_TYPE_PATHS[form.type]}`;

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6 md:pb-8">
      <Link to={typeCatalogHref} className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> {activeType.label}
      </Link>

      <h1 className="mb-6 font-display text-2xl text-accent">
        {isEdit ? 'Редагування предмета' : (EQUIPMENT_NEW_LABELS[form.type] || 'Новий предмет')}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormSection title="Загальне">
          <Field label="Тип" className="mb-4">
            <KindSwitch
              kinds={domain.kindSwitch}
              active={form.type}
              localKeys={['weapon', 'armor', 'item']}
              onSelectLocal={(key) => setForm((f) => ({ ...f, type: key }))}
            />
          </Field>

          <Field label="Назва" className="mb-4">
            <input type="text" className={inputClass} value={form.name} onChange={set('name')} required maxLength={200} />
          </Field>

          <ImageUploadField
            value={form.image_url}
            onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
            entityType="item"
          />
        </FormSection>

        <FormSection title="Механіка">
          {form.type === 'weapon' && (
            <>
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Кубик шкоди">
                  <select className={inputClass} value={form.damage_die} onChange={set('damage_die')}>
                    <option value="">Не обрано</option>
                    {DAMAGE_DICE.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Модифікатор">
                  <select className={inputClass} value={modifierSelectValue} onChange={handleModifierSelect}>
                    <option value="">Не обрано</option>
                    {Object.entries(WEAPON_MODIFIERS).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                    <option value="other">Інше</option>
                  </select>
                  {showModifierPicker && (
                    <select className={`${inputClass} mt-2`} value={form.modifier} onChange={set('modifier')}>
                      <option value="">Обери навичку</option>
                      {CHARACTERISTICS.map((c) => (
                        <optgroup key={c.key} label={c.label}>
                          {c.skills.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Орієнтовна вартість">
                  <input
                    type="number" min={0} step="0.01" className={inputClass}
                    value={form.price} onChange={set('price')}
                    placeholder="не обов'язково" title="Уточніть у майстра"
                  />
                </Field>
              </div>
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Тип зброї">
                  <select className={inputClass} value={form.weapon_type} onChange={set('weapon_type')}>
                    <option value="">Не обрано</option>
                    {weaponTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Особливості">
                  <MultiSelectDropdown
                    options={weaponGrips}
                    value={form.weapon_grip}
                    onChange={(grips) => setForm((f) => ({ ...f, weapon_grip: grips }))}
                  />
                </Field>
              </div>
            </>
          )}
          {form.type === 'armor' && (
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Пасивний захист">
                <input type="number" min={0} className={inputClass} value={form.defense_value} onChange={set('defense_value')} />
              </Field>
              <Field label="Вага">
                <select className={inputClass} value={form.armor_weight} onChange={set('armor_weight')}>
                  <option value="">Не обрано</option>
                  {Object.entries(ARMOR_WEIGHTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Field>
            </div>
          )}
          {form.type === 'item' && (
            <p className="mb-4 text-sm text-text-dim">Для звичайних предметів механічні поля не потрібні — опиши ефект нижче.</p>
          )}

          {form.type !== 'weapon' && (
            <Field label="Орієнтовна вартість">
              <input
                type="number" min={0} step="0.01" className={inputClass}
                value={form.price} onChange={set('price')}
                placeholder="не обов'язково" title="Уточніть у майстра"
              />
            </Field>
          )}
        </FormSection>

        <FormSection title="Опис">
          <SmartTextarea
            value={form.description} onChange={set('description')}
            rows={4}
            placeholder="Що це за предмет, як виглядає, які має властивості..."
          />
        </FormSection>

        <FormSection title="Колекції">
          <CollectionMembershipPicker
            collections={collections}
            basePath={domain.basePath}
            value={form.collectionIds}
            onChange={(ids) => setForm((f) => ({ ...f, collectionIds: ids }))}
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

        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex justify-end gap-3 border-t border-border bg-surface px-4 py-3 md:static md:border-0 md:bg-transparent md:px-0 md:py-0">
          <Button type="button" variant="ghost" to={isEdit ? `/equipment/${id}` : typeCatalogHref}>
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
