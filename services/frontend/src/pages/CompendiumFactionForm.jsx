import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import compendiumApi from '../api/compendium';
import { COLLECTION_DOMAINS } from '../collectionsDomains';
import Field, { inputClass } from '../components/ui/Field';
import SmartTextarea from '../components/ui/SmartTextarea';
import Button from '../components/ui/Button';
import ImageUploadField from '../components/ui/ImageUploadField';
import KindSwitch from '../components/KindSwitch';
import CatalogAttachPicker from '../components/compendium/CatalogAttachPicker';
import FactionMemberPicker from '../components/compendium/FactionMemberPicker';

const domain = COLLECTION_DOMAINS.compendium;
const EMPTY = { name: '', description: '', symbol_url: '', is_public: false };

// NPC-only catalog source for the leader picker — reuses CatalogAttachPicker
// the same way CompendiumEntryForm.jsx does for spells/abilities/equipment.
const npcCatalogApi = { getAll: () => compendiumApi.listEntries('npc') };

export default function CompendiumFactionForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [leaders, setLeaders] = useState([]);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!isEdit) return;
    compendiumApi.getFaction(id)
      .then((f) => setForm({ name: f.name, description: f.description || '', symbol_url: f.symbol_url || '', is_public: f.is_public }))
      .catch(() => navigate('/compendium/factions'))
      .finally(() => setLoading(false));
  }, [id]);

  const reloadRelations = () => {
    if (!isEdit) return;
    compendiumApi.listFactionLeaders(id).then(setLeaders).catch(() => {});
    compendiumApi.listFactionMembers(id).then(setMembers).catch(() => {});
  };

  useEffect(reloadRelations, [id, isEdit]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Вкажи назву'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, symbol_url: form.symbol_url || null };
      if (isEdit) {
        await compendiumApi.updateFaction(id, payload);
        navigate(`/compendium/factions/${id}`);
      } else {
        const created = await compendiumApi.createFaction(payload);
        navigate(`/compendium/factions/${created.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  const backTo = isEdit ? `/compendium/factions/${id}` : '/compendium/factions';

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6 md:pb-8">
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Фракції
      </Link>

      <h1 className="mb-6 font-display text-2xl text-accent">{isEdit ? `Редагування: ${form.name}` : 'Нова фракція'}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormSection title="Загальне">
          <Field label="Тип" className="mb-4">
            <KindSwitch kinds={domain.kindSwitch} active="faction" />
          </Field>

          <Field label="Назва" className="mb-4">
            <input type="text" className={inputClass} value={form.name} onChange={set('name')} required maxLength={200} />
          </Field>

          <SmartTextarea
            label="Опис" className="mb-4" rows={4} value={form.description}
            onChange={set('description')} placeholder="Мета, ідеологія, вплив у світі..."
          />

          <ImageUploadField
            value={form.symbol_url}
            onChange={(url) => setForm((f) => ({ ...f, symbol_url: url }))}
            entityType="item"
            label="Символ"
          />
        </FormSection>

        {isEdit ? (
          <FormSection title="Керівники та учасники">
            <div className="flex flex-col gap-5">
              <CatalogAttachPicker
                label="Керівники" addLabel="Додати керівника"
                catalogApi={npcCatalogApi} attached={leaders} attachedIdField="npc_entry_id" itemField="npc"
                onAdd={(npcId) => compendiumApi.addFactionLeader(id, npcId).then(reloadRelations)}
                onRemove={(npcId) => compendiumApi.removeFactionLeader(id, npcId).then(reloadRelations)}
                itemLink={(item) => `/compendium/entries/${item.id}`}
              />
              <FactionMemberPicker
                label="Учасники" addLabel="Додати учасника" attached={members}
                onAdd={(memberType, memberId) => compendiumApi.addFactionMember(id, memberType, memberId).then(reloadRelations)}
                onRemove={(memberType, memberId) => compendiumApi.removeFactionMember(id, memberType, memberId).then(reloadRelations)}
              />
            </div>
          </FormSection>
        ) : (
          <p className="text-sm text-text-dim">Збережи фракцію, щоб додати керівників і учасників.</p>
        )}

        <FormSection title="Налаштування">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
            <input
              type="checkbox" checked={form.is_public}
              onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
              className="h-5 w-5 accent-accent"
            />
            Публічна — видима усім гравцям
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
