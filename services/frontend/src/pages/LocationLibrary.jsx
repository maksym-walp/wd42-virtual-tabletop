import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import mapsApi from '../api/maps';
import { useAuth } from '../context/AuthContext';
import useViewMode from '../hooks/useViewMode';
import { pluralizeUk } from '../utils/pluralize';
import { resolveLocationVersion } from '../constants/maps';
import { downloadJsonFile } from '../utils/downloadJson';
import { buildLocationImportTemplate } from '../utils/locationImportTemplate';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import ViewToggle from '../components/ui/ViewToggle';
import DataTable from '../components/ui/DataTable';
import ExportImportActions from '../components/ExportImportActions';
import LocationEditor from '../components/map/LocationEditor';
import MarkerIcon from '../components/map/MarkerIcon';
import MapsTabs from '../components/map/MapsTabs';

function snippet(text, n = 90) {
  if (!text) return '—';
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

// The base version's text/image is what the library card/table shows.
const baseVersion = (loc) => resolveLocationVersion(loc.versions, null);

const LOCATION_COLUMNS = [
  { key: 'name', label: 'Назва', render: (loc) => (
    <span className="inline-flex items-center gap-1.5"><MarkerIcon icon={loc.marker_icon} size={14} /> {loc.name}</span>
  ) },
  { key: 'types', label: 'Типи', render: (loc) => (loc.types?.length ? loc.types.join(', ') : '—') },
  { key: 'description', label: 'Опис', render: (loc) => snippet(baseVersion(loc)?.description) },
];

// The user's own reusable location library — create/edit lore entities without
// attaching them to a map yet. Cards or table view.
export default function LocationLibrary() {
  const { user } = useAuth();
  const canCreate = user?.role === 'game_master' || user?.role === 'admin';
  const [mode, setMode] = useViewMode('locations');

  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // location object, {} for new, or null

  const load = () => mapsApi.listLocations()
    .then(setLocations)
    .catch(() => setError('Не вдалось завантажити локації'))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const openEdit = (loc) => setEditing(loc);

  const handleExport = async () => {
    try {
      downloadJsonFile(await mapsApi.exportLocations(), 'locations_export.json');
    } catch {
      alert('Не вдалося експортувати локації');
    }
  };

  const handleImport = async (data) => {
    if (!Array.isArray(data)) { alert('Файл має містити масив локацій'); return; }
    try {
      const { imported } = await mapsApi.importLocations(data);
      alert(`Імпортовано локацій: ${imported}`);
      setLoading(true);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Не вдалося імпортувати локації');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <MapsTabs />

      <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="col-start-1">
          <ViewToggle mode={mode} onChange={setMode} />
        </div>
        <p className="col-start-2 hidden justify-self-center text-sm text-text-dim sm:block">
          {locations.length} {pluralizeUk(locations.length, ['локація', 'локації', 'локацій'])}
        </p>
        {canCreate && (
          <div className="col-start-3 flex items-center justify-end gap-2">
            <ExportImportActions
              onExport={handleExport}
              onImport={handleImport}
              onTemplate={buildLocationImportTemplate}
            />
            <Button size="sm" onClick={() => setEditing({})}>
              <Plus size={15} /> Створити локацію
            </Button>
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : locations.length === 0 ? (
        <EmptyState icon="📍" title="Ще немає локацій">
          {canCreate ? 'Створіть локацію — потім її можна ставити мітками на будь-яку вашу мапу.' : 'Локацій поки немає.'}
        </EmptyState>
      ) : mode === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {locations.map((loc) => {
            const base = baseVersion(loc);
            return (
              <Card key={loc.id} className="cursor-pointer hover:border-accent/50" onClick={() => openEdit(loc)}>
                <div className="flex items-start gap-3">
                  {base?.image_url && (
                    <img src={base.image_url} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded border border-border object-cover" />
                  )}
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 truncate font-display text-base text-text">
                      <MarkerIcon icon={loc.marker_icon} size={16} /> {loc.name}
                    </h3>
                    {loc.types?.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {loc.types.map((t) => (
                          <Badge key={t} className="border border-border text-text-muted">{t}</Badge>
                        ))}
                      </span>
                    )}
                    {base?.description && <p className="mt-2 line-clamp-2 text-sm text-text-dim">{base.description}</p>}
                    {loc.versions?.length > 1 && (
                      <p className="mt-1 text-xs text-text-dim">{loc.versions.length} хронологічні версії</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <DataTable items={locations} columns={LOCATION_COLUMNS} getKey={(loc) => loc.id} onRowClick={openEdit} />
      )}

      {editing && (
        <LocationEditor
          location={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setLoading(true); load(); }}
        />
      )}
    </div>
  );
}
