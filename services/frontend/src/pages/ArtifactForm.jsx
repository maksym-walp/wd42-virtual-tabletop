import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import { ARTIFACT_TYPE, RARITIES } from '../constants/artifacts';
import { COLLECTION_DOMAINS } from '../collectionsDomains';
import Field, { inputClass } from '../components/ui/Field';
import ImageUploadField from '../components/ui/ImageUploadField';
import Button from '../components/ui/Button';
import CollectionMembershipPicker from '../components/CollectionMembershipPicker';

const domain = COLLECTION_DOMAINS.artifacts;

const EMPTY = {
  name: '', description: '', is_public: true,
  price: '', image_url: '',
  creator: '', rarity: '',
  collectionIds: [],
};

export default function ArtifactForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
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
    api.get(`/api/artifacts/${id}`)
      .then(({ data }) => {
        const a = data.artifact;
        setForm((f) => ({
          ...f,
          name: a.name,
          description: a.description || '', is_public: a.is_public,
          price: a.price ?? '', image_url: a.image_url || '',
          creator: a.creator || '', rarity: a.rarity || '',
        }));
      })
      .catch(() => navigate('/artifacts'))
      .finally(() => setLoading(false));
  }, [id]);

  // Membership can only be resolved once both the artifact (to know its id, in
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

  const reconcileCollections = async (artifactId) => {
    const before = initialCollectionIds.current;
    const after = form.collectionIds;
    const toAdd = after.filter((cid) => !before.includes(cid));
    const toRemove = before.filter((cid) => !after.includes(cid));
    await Promise.all([
      ...toAdd.map((cid) => domain.collectionsApi.addItem(cid, domain.itemIdField, artifactId)),
      ...toRemove.map((cid) => domain.collectionsApi.removeItem(cid, artifactId)),
    ]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Вкажи назву артефакта'); return; }
    setSaving(true);
    setError('');
    try {
      const { collectionIds, ...rest } = form;
      const payload = {
        ...rest,
        price: form.price === '' ? null : Number(form.price),
        image_url: form.image_url || null,
        creator: form.creator || null,
        rarity: form.rarity || null,
      };
      if (isEdit) {
        await api.put(`/api/artifacts/${id}`, payload);
        await reconcileCollections(id);
        navigate(`/artifacts/${id}`);
      } else {
        const { data } = await api.post('/api/artifacts/', payload);
        await reconcileCollections(data.artifact.id);
        navigate(`/artifacts/${data.artifact.id}`);
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
      <Link to="/artifacts" className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Артефакти
      </Link>

      <h1 className="mb-6 font-display text-2xl text-accent">
        {isEdit ? 'Редагування артефакта' : 'Новий артефакт'}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormSection title="Загальне" accentColor={ARTIFACT_TYPE.color}>
          <Field label="Назва" className="mb-4">
            <input type="text" className={inputClass} value={form.name} onChange={set('name')} required maxLength={200} />
          </Field>

          <ImageUploadField
            value={form.image_url}
            onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
            entityType="item"
          />
        </FormSection>

        <FormSection title="Походження" accentColor={ARTIFACT_TYPE.color}>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Творець">
              <input type="text" className={inputClass} value={form.creator} onChange={set('creator')} maxLength={200} />
            </Field>
            <Field label="Рідкість">
              <select className={inputClass} value={form.rarity} onChange={set('rarity')}>
                <option value="">Не обрано</option>
                {Object.entries(RARITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Середня ціна (умовні одиниці)">
            <input type="number" min={0} className={inputClass} value={form.price} onChange={set('price')} placeholder="Необов'язково" />
          </Field>
        </FormSection>

        <FormSection title="Опис" accentColor={ARTIFACT_TYPE.color}>
          <textarea
            className={`${inputClass} resize-y`}
            value={form.description} onChange={set('description')}
            rows={4}
            placeholder="Що це за артефакт, як виглядає, які має властивості..."
          />
        </FormSection>

        <FormSection title="Колекції" accentColor={ARTIFACT_TYPE.color}>
          <CollectionMembershipPicker
            collections={collections}
            basePath={domain.basePath}
            value={form.collectionIds}
            onChange={(ids) => setForm((f) => ({ ...f, collectionIds: ids }))}
          />
        </FormSection>

        <FormSection title="Налаштування" accentColor={ARTIFACT_TYPE.color}>
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

        <div className="fixed inset-x-0 bottom-16 z-30 flex justify-end gap-3 border-t border-border bg-surface px-4 py-3 md:static md:border-0 md:bg-transparent md:px-0 md:py-0">
          <Button type="button" variant="ghost" to={isEdit ? `/artifacts/${id}` : '/artifacts'}>
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
