import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import skillTreeApi from '../api/skillTree';
import { COLLECTION_DOMAINS } from '../collectionsDomains';
import Field, { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import NodePrerequisitePicker from '../components/NodePrerequisitePicker';

const EMPTY = {
  name: '', description: '', is_public: false,
  prerequisite_node_ids: [], prerequisite_logic: 'or',
};

export default function CollectionForm({ domainKey }) {
  const domain = COLLECTION_DOMAINS[domainKey];
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    if (!domain.supportsPrerequisites) return;
    skillTreeApi.getNodes().then(setNodes).catch(() => {});
  }, [domainKey]);

  useEffect(() => {
    if (!isEdit) return;
    domain.collectionsApi.getOne(id)
      .then((c) => setForm({
        name: c.name, description: c.description || '', is_public: c.is_public,
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
        navigate(`${domain.basePath}/collections/${created.id}`);
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
      <Link to={`${domain.basePath}/collections`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Колекції — {domain.title}
      </Link>

      <h1 className="mb-6 font-display text-2xl text-accent">
        {isEdit ? 'Редагування колекції' : 'Нова колекція'}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormSection title="Загальне">
          <Field label="Назва" className="mb-4">
            <input
              type="text" className={inputClass} value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required maxLength={200}
            />
          </Field>
          <Field label="Опис">
            <textarea
              className={`${inputClass} resize-y`} rows={4} value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Що це за набір, для чого призначений..."
            />
          </Field>
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

        <div className="fixed inset-x-0 bottom-16 z-30 flex justify-end gap-3 border-t border-border bg-surface px-4 py-3 md:static md:border-0 md:bg-transparent md:px-0 md:py-0">
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
