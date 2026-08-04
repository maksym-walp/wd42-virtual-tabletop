import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import skillTreeApi from '../api/skillTree';
import { DURATION_OPTIONS } from '../constants/maneuvers';
import { COLLECTION_DOMAINS } from '../collectionsDomains';
import Field, { inputClass } from '../components/ui/Field';
import SmartTextarea from '../components/ui/SmartTextarea';
import ImageUploadField from '../components/ui/ImageUploadField';
import Button from '../components/ui/Button';
import NodePrerequisitePicker from '../components/NodePrerequisitePicker';
import CollectionMembershipPicker from '../components/CollectionMembershipPicker';
import KindSwitch from '../components/KindSwitch';

const domain = COLLECTION_DOMAINS.abilities;

const EMPTY = {
  name: '', duration_actions: 1, description: '', is_public: true,
  prerequisite_node_ids: [], prerequisite_logic: 'or',
  image_url: '',
  collectionIds: [],
};

export default function ManeuverForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [nodes, setNodes] = useState([]);
  const [collections, setCollections] = useState([]);
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);
  const initialCollectionIds = useRef([]);
  const membershipInitialized = useRef(false);

  useEffect(() => {
    skillTreeApi.getNodes({ archetype: 'fighter' }).then(setNodes).catch(() => {});
  }, []);

  useEffect(() => {
    domain.collectionsApi.getAll()
      .then((all) => setCollections(all.filter((c) => c.is_owner)))
      .catch(() => {})
      .finally(() => setCollectionsLoaded(true));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/api/abilities/maneuvers/${id}`)
      .then(({ data }) => {
        const m = data.maneuver;
        setForm((f) => ({
          ...f,
          name: m.name, duration_actions: m.duration_actions,
          description: m.description || '', is_public: m.is_public,
          prerequisite_node_ids: m.prerequisite_node_ids || [],
          prerequisite_logic: m.prerequisite_logic || 'or',
          image_url: m.image_url || '',
        }));
      })
      .catch(() => navigate('/abilities/maneuvers'))
      .finally(() => setLoading(false));
  }, [id]);

  // Membership can only be resolved once both the maneuver (to know its id,
  // in edit mode) and the user's own collections (to check which contain it)
  // have loaded — runs once, then form.collectionIds is the source of truth.
  useEffect(() => {
    if (!isEdit || membershipInitialized.current || loading || !collectionsLoaded) return;
    const memberIds = collections.filter((c) => (c.items || []).some((it) => it.id === id)).map((c) => c.id);
    initialCollectionIds.current = memberIds;
    setForm((f) => ({ ...f, collectionIds: memberIds }));
    membershipInitialized.current = true;
  }, [isEdit, loading, collectionsLoaded, collections, id]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setNum = (field) => (e) => setForm((f) => ({ ...f, [field]: Number(e.target.value) }));

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
    if (!form.name.trim()) { setError('Вкажи назву маневру'); return; }
    setSaving(true);
    setError('');
    try {
      const { collectionIds, ...rest } = form;
      const payload = {
        ...rest,
        duration_actions: Number(form.duration_actions),
        image_url: form.image_url || null,
      };
      if (isEdit) {
        await api.put(`/api/abilities/maneuvers/${id}`, payload);
        await reconcileCollections(id);
        navigate(`/abilities/maneuvers/${id}`);
      } else {
        const { data } = await api.post('/api/abilities/maneuvers/', payload);
        await reconcileCollections(data.maneuver.id);
        navigate(`/abilities/maneuvers/${data.maneuver.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6 md:pb-8">
      <Link to="/abilities/maneuvers" className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Маневри
      </Link>

      <h1 className="mb-6 font-display text-2xl text-accent">
        {isEdit ? 'Редагування маневру' : 'Новий маневр'}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormSection title="Загальне">
          <Field label="Тип" className="mb-4">
            <KindSwitch kinds={domain.kindSwitch} active="maneuver" />
          </Field>

          <Field label="Назва" className="mb-4">
            <input type="text" className={inputClass} value={form.name} onChange={set('name')} required maxLength={200} />
          </Field>

          <Field label="Тривалість" className="mb-4">
            <select className={inputClass} value={form.duration_actions} onChange={setNum('duration_actions')}>
              {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          <ImageUploadField
            value={form.image_url}
            onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
            entityType="item"
          />
        </FormSection>

        <FormSection title="Опис">
          <SmartTextarea
            value={form.description} onChange={set('description')}
            rows={4}
            placeholder="Що відбувається механічно, коли персонаж виконує цей маневр..."
          />
        </FormSection>

        <FormSection title="Вимоги дерева розвитку">
          <NodePrerequisitePicker
            nodes={nodes}
            value={form}
            onChange={(next) => setForm((f) => ({ ...f, ...next }))}
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
          <Button type="button" variant="ghost" to={isEdit ? `/abilities/maneuvers/${id}` : '/abilities/maneuvers'}>
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
