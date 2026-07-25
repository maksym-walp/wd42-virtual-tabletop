import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import mapsApi from '../api/maps';
import { useAuth } from '../context/AuthContext';
import useViewMode from '../hooks/useViewMode';
import { useMarkerTypes } from '../context/MarkerTypesContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import ViewToggle from '../components/ui/ViewToggle';
import Sheet from '../components/ui/Sheet';
import LocationFields from '../components/map/LocationFields';
import TypeIcon from '../components/map/TypeIcon';
import MapsTabs from '../components/map/MapsTabs';

const BLANK = { name: '', type: null, description: '', gm_note: '', image_url: null };

function snippet(text, n = 90) {
  if (!text) return '—';
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

// The user's own reusable location library — create/edit lore entities without
// attaching them to a map yet. Cards or table view.
export default function LocationLibrary() {
  const { user } = useAuth();
  const mt = useMarkerTypes();
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
    image_url: loc.image_url || null,
  });

  return (
    <div className="mx-auto max-w-[900px] px-4 pt-6 pb-28 sm:px-6 md:pb-16">
      <h1 className="mb-4 font-display text-3xl font-bold text-text">Мапи</h1>
      <MapsTabs />

      <div className="mb-4 flex items-center justify-between gap-3">
        <ViewToggle mode={mode} onChange={setMode} />
        {canCreate && (
          <Button size="sm" onClick={() => setEditing({ ...BLANK })}>
            <Plus size={15} /> Створити локацію
          </Button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-text-dim">Завантаження…</p>
      ) : locations.length === 0 ? (
        <EmptyState icon="📍" title="Ще немає локацій">
          {canCreate ? 'Створіть локацію — потім її можна ставити мітками на будь-яку вашу мапу.' : 'Локацій поки немає.'}
        </EmptyState>
      ) : mode === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {locations.map((loc) => {
            const meta = mt.metaFor(loc.type);
            return (
              <Card key={loc.id} className="cursor-pointer hover:border-accent/50" onClick={() => openEdit(loc)}>
                <div className="flex items-start gap-3">
                  {loc.image_url && (
                    <img src={loc.image_url} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded border border-border object-cover" />
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-base text-text">{loc.name}</h3>
                    <Badge className="mt-1 inline-flex items-center gap-1.5 border border-border text-text-muted">
                      <TypeIcon typeKey={loc.type} size={14} /> {meta.label}
                    </Badge>
                    {loc.description && <p className="mt-2 line-clamp-2 text-sm text-text-dim">{loc.description}</p>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-text-dim">
                <th className="px-3 py-2 font-semibold">Назва</th>
                <th className="px-3 py-2 font-semibold">Тип</th>
                <th className="px-3 py-2 font-semibold">Опис</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => {
                const meta = mt.metaFor(loc.type);
                return (
                  <tr key={loc.id} onClick={() => openEdit(loc)} className="cursor-pointer border-b border-border last:border-0 hover:bg-bg">
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-accent">{loc.name}</td>
                    <td className="whitespace-nowrap px-3 py-2"><span className="inline-flex items-center gap-1.5"><TypeIcon typeKey={loc.type} size={14} /> {meta.label}</span></td>
                    <td className="px-3 py-2 text-text-dim">{snippet(loc.description)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
    image_url: draft.image_url || null,
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
            <Button onClick={save} disabled={saving}>{saving ? 'Збереження…' : 'Зберегти'}</Button>
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
