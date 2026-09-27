import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Globe, Lock, Map as MapIcon } from 'lucide-react';
import mapsApi from '../api/maps';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { inputClass } from '../components/ui/Field';
import MapsTabs from '../components/map/MapsTabs';
import useHoverPreview from '../hooks/useHoverPreview';
import CatalogLayout, {
  SidebarViewCount,
} from '../components/catalog/CatalogLayout';
import { CatalogPreview, SimplePreview } from '../components/catalog/previews';

export default function MapList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = user?.role === 'game_master' || user?.role === 'admin';

  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hovered, bindPreview] = useHoverPreview();

  useEffect(() => {
    let alive = true;
    mapsApi.list()
      .then((rows) => { if (alive) setMaps(rows); })
      .catch(() => { if (alive) setError('Не вдалось завантажити мапи'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const map = await mapsApi.create({ name: name.trim(), is_public: isPublic });
      navigate(`/maps/${map.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось створити мапу');
      setSaving(false);
    }
  };

  const sidebar = (
    <>
      <MapsTabs sidebar />
      {canCreate && !creating && (
        <Button onClick={() => setCreating(true)}>
          <Plus size={15} /> Створити мапу
        </Button>
      )}
      <SidebarViewCount count={maps.length} forms={['мапа', 'мапи', 'мап']} />
    </>
  );

  return (
    <CatalogLayout
      sidebar={sidebar}
      preview={
        <CatalogPreview item={hovered}>
          {hovered && (
            <SimplePreview
              href={`/maps/${hovered.id}`}
              image={hovered.thumbnail_url || hovered.image_url}
              badges={[hovered.is_public ? 'Публічна' : 'Приватна', hovered.is_owner ? 'ваша мапа' : null]}
              title={hovered.name}
              description={hovered.description}
            />
          )}
        </CatalogPreview>
      }
    >
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {creating && (
        <Card className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Нова мапа</p>
          <div className="flex flex-col gap-3">
            <input
              autoFocus
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Назва мапи"
              maxLength={200}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)}
                className="h-5 w-5 accent-accent"
              />
              Публічна (бачать усі користувачі)
            </label>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={saving}>{saving ? 'Створення...' : 'Створити'}</Button>
              <Button variant="ghost" onClick={() => { setCreating(false); setName(''); setIsPublic(false); }}>Скасувати</Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : maps.length === 0 ? (
        <EmptyState icon="🗺" title="Ще немає жодної мапи">
          {canCreate ? 'Створіть першу мапу.' : 'Публічних мап поки немає.'}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {maps.map((m) => (
            <Link key={m.id} to={`/maps/${m.id}`} className="block" {...bindPreview(m)}>
              <Card className="cursor-pointer hover:border-accent/50">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-display text-base text-text">
                    <MapIcon size={16} className="text-text-dim" /> {m.name}
                  </h3>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-text-dim" title={m.is_public ? 'Публічна' : 'Приватна'}>
                    {m.is_public ? <Globe size={13} /> : <Lock size={13} />}
                  </span>
                </div>
                {m.is_owner && <p className="mt-2 text-xs text-accent">ваша мапа</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </CatalogLayout>
  );
}
