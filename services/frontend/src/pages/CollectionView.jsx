import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Share2, Check } from 'lucide-react';
import { COLLECTION_DOMAINS } from '../collectionsDomains';
import Button from '../components/ui/Button';
import Sheet from '../components/ui/Sheet';
import { inputClass } from '../components/ui/Field';
import { useAuth } from '../context/AuthContext';

export default function CollectionView({ domainKey, publicView = false }) {
  const domain = COLLECTION_DOMAINS[domainKey];
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [settingCanonical, setSettingCanonical] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const load = () => (publicView ? domain.collectionsApi.getPublic(id) : domain.collectionsApi.getOne(id));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then((c) => { if (!cancelled) setCollection(c); })
      .catch(() => {
        if (cancelled) return;
        setCollection(null);
        if (!publicView) navigate(`${domain.basePath}/collections`, { replace: true });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, domainKey, publicView]);

  useEffect(() => {
    if (publicView || !showPicker) return;
    domain.catalogApi.getAll().then(setCatalog).catch(() => {});
  }, [showPicker, domainKey, publicView]);

  const handleDelete = async () => {
    if (!confirm('Видалити цю колекцію?')) return;
    setDeleting(true);
    try {
      await domain.collectionsApi.remove(id);
      navigate(`${domain.basePath}/collections`);
    } catch {
      setDeleting(false);
    }
  };

  const handleAddItem = async (itemId) => {
    await domain.collectionsApi.addItem(id, domain.itemIdField, itemId);
    setShowPicker(false);
    setCollection(await load());
  };

  const handleRemoveItem = async (itemId) => {
    await domain.collectionsApi.removeItem(id, itemId);
    setCollection(await load());
  };

  const handleMarkCanonical = async () => {
    setSettingCanonical(true);
    try {
      setCollection(await domain.collectionsApi.setCanonical(id, true));
    } finally {
      setSettingCanonical(false);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!collection) {
    return (
      <div className="px-4 py-16 text-center text-text-dim">
        Колекцію не знайдено{publicView ? ' або вона приватна' : ''}
      </div>
    );
  }

  const items = collection.items || [];
  const knownIds = new Set(items.map((i) => i.id));
  const filteredCatalog = catalog.filter(
    (i) => !knownIds.has(i.id) && i.name?.toLowerCase().includes(search.toLowerCase())
  );
  const shareUrl = `${window.location.origin}${domain.basePath}/collections/public/${id}`;
  const isAdmin = user?.role === 'admin';
  const canManageCanonical = isAdmin || user?.role === 'game_master';
  const canManage = collection.is_owner || isAdmin;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      {!publicView && (
        <Link to={`${domain.basePath}/collections`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
          <ArrowLeft size={15} /> Колекції — {domain.title}
        </Link>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-surface" style={{ borderTop: '3px solid var(--color-accent)' }}>
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">
            {items.length} {domain.itemLabel}
          </span>
          {collection.is_public && <span className="text-xs italic text-text-dim">публічна</span>}
        </div>

        <h1 className="px-5 pb-1 pt-4 font-display text-3xl text-accent">{collection.name}</h1>
        {collection.description && <p className="px-5 pb-3 text-sm text-text-muted">{collection.description}</p>}

        {(collection.prerequisite_node_ids || []).length > 0 && (
          <div className="mx-5 mb-3 rounded-md border border-border bg-bg px-3 py-2 text-xs text-text-dim">
            Успадкована вимога дерева розвитку для всіх елементів колекції
            {collection.prerequisite_logic === 'and' ? ' (потрібні всі вузли)' : ' (достатньо одного вузла)'}.
          </div>
        )}

        {collection.is_public && (
          <div className="mx-5 mb-3 flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 text-xs text-text-dim">
            <Share2 size={14} className="shrink-0" />
            <span className="truncate">{shareUrl}</span>
            <button type="button" className="ml-auto flex shrink-0 items-center gap-1 text-accent" onClick={copyShareLink}>
              {copied ? <><Check size={13} /> Скопійовано</> : 'Копіювати'}
            </button>
          </div>
        )}

        <div className="border-t border-border">
          <div className="flex items-center justify-between bg-bg px-5 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Елементи</span>
            {!publicView && canManage && (
              <button type="button" className="text-xs font-semibold text-accent" onClick={() => setShowPicker(true)}>
                + Додати
              </button>
            )}
          </div>
          <div className="px-5 py-3">
            {items.length === 0 && <p className="text-sm text-text-dim">Колекція порожня</p>}
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b border-bg py-2 last:border-0">
                <Link to={domain.itemLink(item)} className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm text-text">{item.name}</span>
                  {domain.itemMeta(item) && <span className="text-xs text-text-dim">{domain.itemMeta(item)}</span>}
                </Link>
                {!publicView && canManage && (
                  <button type="button" className="px-2 text-sm text-danger" onClick={() => handleRemoveItem(item.id)}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {!publicView && canManageCanonical && !collection.is_canonical && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" onClick={handleMarkCanonical} disabled={settingCanonical}>
              {settingCanonical ? 'Позначення...' : 'Зробити канонічним'}
            </Button>
          </div>
        )}

        {!publicView && canManage && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" to={`${domain.basePath}/collections/${id}/edit`}>Редагувати</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Видалення...' : 'Видалити'}
            </Button>
          </div>
        )}
      </div>

      <Sheet open={showPicker} onClose={() => setShowPicker(false)} title="Додати елемент">
        <input
          className={`${inputClass} mb-3 text-sm`} placeholder="Пошук..." value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-[300px] overflow-y-auto">
          {filteredCatalog.length === 0 && <p className="py-3 text-sm text-text-dim">Немає доступних елементів</p>}
          {filteredCatalog.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-b border-border/50 py-2 last:border-0">
              <div className="flex flex-col">
                <span className="text-sm text-text">{item.name}</span>
                {domain.itemMeta(item) && <span className="text-xs text-text-dim">{domain.itemMeta(item)}</span>}
              </div>
              <button type="button" className="text-sm text-accent" onClick={() => handleAddItem(item.id)}>+</button>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
