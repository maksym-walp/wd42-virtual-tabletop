import { useEffect, useState } from 'react';
import { X, Share2, Check, Pencil, Trash2, MapPin } from 'lucide-react';
import mapsApi from '../../api/maps';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import SmartTextReader from '../SmartTextReader';
import LocationFields from './LocationFields';
import MarkerIcon from './MarkerIcon';
import ImageSlider from './ImageSlider';

const toEditValue = (l) => ({
  name: l.name || '',
  type: l.type || null,
  description: l.description || '',
  gm_note: l.gm_note || '',
  image_urls: l.image_urls || [],
  marker_icon: l.marker_icon || null,
  marker_level: l.marker_level ?? null,
});

// Side panel (right rail on desktop, bottom sheet on mobile) showing a location.
// gm_note is returned by the server only for the owner/admin; `isGm` here also
// unlocks editing / deleting and (when a pin is given) removing the pin.
export default function LocationDrawer({ locationId, isGm, pinId, onRemovePin, onDeleteLocation, onLocationUpdated, onClose }) {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setLocation(null);
    setEditing(false);
    mapsApi.getLocation(locationId)
      .then((l) => { if (alive) setLocation(l); })
      .catch(() => { if (alive) setError('Не вдалось завантажити локацію'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [locationId]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — no-op */ }
  };

  const startEdit = () => { setDraft(toEditValue(location)); setEditing(true); };

  const saveEdit = async () => {
    if (!draft.name.trim()) { setError('Вкажіть назву'); return; }
    setSaving(true);
    setError('');
    try {
      const updated = await mapsApi.updateLocation(locationId, {
        name: draft.name.trim(),
        type: draft.type || null,
        description: draft.description || null,
        gm_note: draft.gm_note || null,
        image_urls: draft.image_urls || [],
        marker_icon: draft.marker_icon || null,
        marker_level: draft.marker_level ?? null,
      });
      setLocation(updated);
      setEditing(false);
      onLocationUpdated?.(updated);
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось зберегти');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={location?.name || 'Локація'}
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-96 sm:rounded-none sm:border-l sm:border-t-0"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="m-0 font-display text-xl text-text">
          {loading ? 'Завантаження…' : (editing ? 'Редагування' : (location?.name || 'Локація'))}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {!editing && (
            <button onClick={copyLink} aria-label="Скопіювати посилання" title="Скопіювати посилання" className="rounded-full p-2 text-text-dim hover:bg-surface-hover hover:text-accent">
              {copied ? <Check size={18} /> : <Share2 size={18} />}
            </button>
          )}
          <button onClick={onClose} aria-label="Закрити" className="rounded-full p-2 text-text-dim hover:bg-surface-hover">
            <X size={18} />
          </button>
        </div>
      </div>

      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {editing ? (
        <div className="flex flex-col gap-4">
          <LocationFields value={draft} onChange={setDraft} />
          <div className="flex gap-2">
            <Button onClick={saveEdit} disabled={saving}>{saving ? 'Збереження…' : 'Зберегти'}</Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>Скасувати</Button>
          </div>
        </div>
      ) : location && (
        <div className="flex flex-col gap-4">
          <div>
            <Badge className="inline-flex items-center gap-1.5 border border-border text-text-muted">
              <MarkerIcon icon={location.marker_icon} size={14} /> {location.type || 'Локація'}
            </Badge>
          </div>

          {location.image_urls?.length > 0 && <ImageSlider images={location.image_urls} />}

          {location.description && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-text">
              <SmartTextReader text={location.description} />
            </div>
          )}

          {isGm && location.gm_note && (
            <div className="rounded-lg border border-gold/50 bg-gold/10 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gold">Нотатка майстра</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{location.gm_note}</p>
            </div>
          )}

          {!location.description && !location.image_urls?.length && !(isGm && location.gm_note) && (
            <p className="text-sm text-text-dim">Опис відсутній.</p>
          )}

          {isGm && (
            <div className="mt-1 flex flex-wrap gap-2 border-t border-border pt-3">
              <Button variant="ghost" size="sm" onClick={startEdit}><Pencil size={14} /> Редагувати</Button>
              {pinId && (
                <Button variant="ghost" size="sm" onClick={() => onRemovePin?.(pinId)}>
                  <MapPin size={14} /> Прибрати мітку
                </Button>
              )}
              <Button variant="danger" size="sm" onClick={() => { if (confirm('Видалити локацію разом з усіма її мітками?')) onDeleteLocation?.(locationId); }}>
                <Trash2 size={14} /> Видалити локацію
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
