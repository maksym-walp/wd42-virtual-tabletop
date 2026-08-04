import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import skillTreeApi from '../api/skillTree';
import { COLLECTION_DOMAINS } from '../collectionsDomains';
import { useAuth } from '../context/AuthContext';
import Field, { inputClass } from '../components/ui/Field';
import SmartTextarea from '../components/ui/SmartTextarea';
import ImageUploadField from '../components/ui/ImageUploadField';
import Button from '../components/ui/Button';
import NodePrerequisitePicker from '../components/NodePrerequisitePicker';
import KindSwitch from '../components/KindSwitch';
import CollectionItemPicker from '../components/CollectionItemPicker';

const EMPTY = {
  name: '', description: '', is_public: false, image_url: '',
  prerequisite_node_ids: [], prerequisite_logic: 'or',
};

export default function CollectionForm({ domainKey }) {
  const domain = COLLECTION_DOMAINS[domainKey];
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  // Creating a tradition is admin/game_master-only (spellbook's kindSwitch
  // carries a 'tradition' entry regardless of who's looking) — everywhere
  // else this filter is a no-op, since no other domain's kindSwitch has that key.
  const canManageTraditions = user?.role === 'admin' || user?.role === 'game_master';
  const kinds = (domain.kindSwitch || []).filter((k) => k.key !== 'tradition' || canManageTraditions);

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [nodes, setNodes] = useState([]);
  // Елементи додаються під час створення лише тут, локальним вибором до
  // POST /collections — самої колекції ще не існує, тож addItem нікуди
  // слати. Після створення керування складом переїжджає в CollectionView
  // (додати/прибрати), тож для редагування цей пікер не показуємо.
  const [catalog, setCatalog] = useState([]);
  const [itemIds, setItemIds] = useState([]);

  useEffect(() => {
    if (!domain.supportsPrerequisites) return;
    skillTreeApi.getNodes().then(setNodes).catch(() => {});
  }, [domainKey]);

  useEffect(() => {
    if (isEdit) return;
    domain.catalogApi.getAll().then(setCatalog).catch(() => {});
  }, [domainKey, isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    domain.collectionsApi.getOne(id)
      .then((c) => setForm({
        name: c.name, description: c.description || '', is_public: c.is_public,
        image_url: c.image_url || '',
        prerequisite_node_ids: c.prerequisite_node_ids || [],
        prerequisite_logic: c.prerequisite_logic || 'or',
      }))
      .catch(() => navigate(`${domain.basePath}/collections`))
      .finally(() => setLoading(false));
  }, [id, domainKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Вкажи назву колекції'); return; }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await domain.collectionsApi.update(id, form);
        navigate(`${domain.basePath}/collections/${id}`);
      } else {
        const created = await domain.collectionsApi.create(form);
        if (itemIds.length > 0) {
          await Promise.all(itemIds.map((itemId) => domain.collectionsApi.addItem(created.id, domain.itemIdField, itemId)));
        }
        navigate(`${domain.basePath}/collections/${created.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = (itemId) => {
    setItemIds((ids) => (ids.includes(itemId) ? ids.filter((v) => v !== itemId) : [...ids, itemId]));
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6 md:pb-8">
      <Link to={`${domain.basePath}/collections`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Колекції
      </Link>

      <h1 className="mb-6 font-display text-2xl text-accent">
        {isEdit ? 'Редагування колекції' : 'Нова колекція'}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormSection title="Загальне">
          {kinds.length > 0 && (
            <Field label="Тип" className="mb-4">
              <KindSwitch kinds={kinds} active="collection" />
            </Field>
          )}

          <Field label="Назва" className="mb-4">
            <input
              type="text" className={inputClass} value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required maxLength={200}
            />
          </Field>

          <div className="mb-4">
            <ImageUploadField
              value={form.image_url}
              onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
              entityType="collection"
            />
          </div>

          <SmartTextarea
            label="Опис"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={4}
            placeholder="Що це за набір, для чого призначений..."
          />
        </FormSection>

        {domain.supportsPrerequisites && (
          <FormSection title="Вимоги дерева розвитку" hint="Ця вимога успадковується всіма елементами колекції.">
            <NodePrerequisitePicker
              nodes={nodes}
              value={form}
              onChange={(next) => setForm((f) => ({ ...f, ...next }))}
            />
          </FormSection>
        )}

        {!isEdit && (
          <FormSection title="Елементи" hint="Можна додати одразу зараз або пізніше зі сторінки колекції.">
            <CollectionItemPicker
              items={catalog}
              selectedIds={itemIds}
              onToggle={toggleItem}
              itemMeta={domain.itemMeta}
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
            Публічна — доступна за посиланням будь-кому
          </label>
        </FormSection>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex justify-end gap-3 border-t border-border bg-surface px-4 py-3 md:static md:border-0 md:bg-transparent md:px-0 md:py-0">
          <Button type="button" variant="ghost" to={isEdit ? `${domain.basePath}/collections/${id}` : `${domain.basePath}/collections`}>
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

function FormSection({ title, hint, children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-border bg-bg px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-text-dim">{title}</span>
        {hint && <p className="mt-0.5 text-[0.7rem] text-text-dim">{hint}</p>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
