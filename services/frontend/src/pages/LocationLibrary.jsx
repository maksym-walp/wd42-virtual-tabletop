import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import mapsApi from '../api/maps';
import { useAuth } from '../context/AuthContext';
import useViewMode from '../hooks/useViewMode';
import { pluralizeUk } from '../utils/pluralize';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import ViewToggle from '../components/ui/ViewToggle';
import DataTable from '../components/ui/DataTable';
import Sheet from '../components/ui/Sheet';
import LocationFields from '../components/map/LocationFields';
import MarkerIcon from '../components/map/MarkerIcon';
import MapsTabs from '../components/map/MapsTabs';

const BLANK = { name: '', type: null, description: '', gm_note: '', image_urls: [], marker_icon: null, marker_level: null };

function snippet(text, n = 90) {
  if (!text) return '—';
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

const LOCATION_COLUMNS = [
  { key: 'name', label: 'Назва', render: (loc) => (
    <span className="inline-flex items-center gap-1.5"><MarkerIcon icon={loc.marker_icon} size={14} /> {loc.name}</span>
  ) },
  { key: 'type', label: 'Тип', render: (loc) => loc.type || '—' },
  { key: 'description', label: 'Опис', render: (loc) => snippet(loc.description) },
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
  const [editing, setEditing] = useState(null); // { id?, ...fields } or null

  const load = () => mapsApi.listLocations()
    .then(setLocations)
    .catch(() => setError('Не вдалось завантажити локації'))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const openEdit = (loc) => setEditing({
    id: loc.id,
    name: loc.name || '',
    type: loc.type || null,
    description: loc.description || '',
    gm_note: loc.gm_note || '',
    image_urls: loc.image_urls || [],
    marker_icon: loc.marker_icon || null,
    marker_level: loc.marker_level ?? null,
  });

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
          <Button size="sm" className="col-start-3 justify-self-end" onClick={() => setEditing({ ...BLANK })}>
            <Plus size={15} /> Створити локацію
          </Button>
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
          {locations.map((loc) => (
            <Card key={loc.id} className="cursor-pointer hover:border-accent/50" onClick={() => openEdit(loc)}>
              <div className="flex items-start gap-3">
                {loc.image_urls?.[0] && (
                  <img src={loc.image_urls[0]} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded border border-border object-cover" />
                )}
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 truncate font-display text-base text-text">
                    <MarkerIcon icon={loc.marker_icon} size={16} /> {loc.name}
                  </h3>
                  {loc.type && <Badge className="mt-1 border border-border text-text-muted">{loc.type}</Badge>}
                  {loc.description && <p className="mt-2 line-clamp-2 text-sm text-text-dim">{loc.description}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <DataTable items={locations} columns={LOCATION_COLUMNS} getKey={(loc) => loc.id} onRowClick={openEdit} />
      )}

      {editing && (
        <LocationEditor
          value={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setLoading(true); load(); }}
        />
      )}
    </div>
  );
}

function LocationEditor({ value, onClose, onSaved }) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(value.id);

  const payload = () => ({
    name: draft.name.trim(),
    type: draft.type || null,
    description: draft.description || null,
    gm_note: draft.gm_note || null,
    image_urls: draft.image_urls || [],
    marker_icon: draft.marker_icon || null,
    marker_level: draft.marker_level ?? null,
  });

  const save = async () => {
    if (!draft.name.trim()) { setError('Вкажіть назву'); return; }
    setSaving(true);
    setError('');
    try {
      if (isEdit) await mapsApi.updateLocation(value.id, payload());
      else await mapsApi.createLocation(payload());
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось зберегти');
      setSaving(false);
    }
  };

  const del = async () => {
    if (!confirm('Видалити локацію разом з усіма її мітками?')) return;
    setSaving(true);
    try {
      await mapsApi.removeLocation(value.id);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось видалити');
      setSaving(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={isEdit ? 'Редагувати локацію' : 'Нова локація'}>
      <div className="flex flex-col gap-4">
        <LocationFields value={draft} onChange={setDraft} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>{saving ? 'Збереження...' : 'Зберегти'}</Button>
            <Button variant="ghost" onClick={onClose}>Скасувати</Button>
          </div>
          {isEdit && (
            <Button variant="danger" size="sm" onClick={del} disabled={saving}>
              <Trash2 size={14} /> Видалити
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
