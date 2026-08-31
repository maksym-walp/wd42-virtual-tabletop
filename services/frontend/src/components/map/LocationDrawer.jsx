import { useEffect, useMemo, useState } from 'react';
import { X, Share2, Check, Pencil, Trash2, MapPin, SlidersHorizontal, Clock } from 'lucide-react';
import mapsApi from '../../api/maps';
import { resolveLocationVersion } from '../../constants/maps';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Lightbox from '../ui/Lightbox';
import SmartTextReader from '../SmartTextReader';
import LocationEditor from './LocationEditor';
import MarkerIcon from './MarkerIcon';

// Side panel (right rail on desktop, bottom sheet on mobile) showing a location.
// gm_note is returned by the server (per-version) only for the owner/admin;
// `isGm` here also unlocks editing / deleting and (when a pin is given)
// editing/removing the pin. `year` is the map's current in-fiction year (from
// the timeline slider / campaign) — it selects which chronological version shows.
export default function LocationDrawer({ locationId, isGm, year, pin, onEditPin, onRemovePin, onDeleteLocation, onLocationUpdated, onClose }) {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const load = () => mapsApi.getLocation(locationId)
    .then((l) => { setLocation(l); return l; })
    .catch(() => { setError('Не вдалось завантажити локацію'); });

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

  const version = useMemo(
    () => resolveLocationVersion(location?.versions, year),
    [location, year],
  );
  const datedCount = (location?.versions || []).filter((v) => v.start_year != null).length;
  // Version overrides win over the base location for name / marker icon / types.
  const displayName = version?.name || location?.name || 'Локація';
  const displayIcon = version?.marker_icon ?? location?.marker_icon;
  const displayTypes = (version && version.types != null) ? version.types : (location?.types || []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — no-op */ }
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={displayName}
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-96 sm:rounded-none sm:border-l sm:border-t-0"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="m-0 font-display text-xl text-text">
          {loading ? 'Завантаження…' : displayName}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={copyLink} aria-label="Скопіювати посилання" title="Скопіювати посилання" className="rounded-full p-2 text-text-dim hover:bg-surface-hover hover:text-accent">
            {copied ? <Check size={18} /> : <Share2 size={18} />}
          </button>
          <button onClick={onClose} aria-label="Закрити" className="rounded-full p-2 text-text-dim hover:bg-surface-hover">
            <X size={18} />
          </button>
        </div>
      </div>

      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {location && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="inline-flex items-center gap-1.5 border border-border text-text-muted">
              <MarkerIcon icon={displayIcon} size={14} />
              {displayTypes.length ? displayTypes.join(' · ') : 'Локація'}
            </Badge>
            {year != null && datedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-text-dim">
                <Clock size={12} /> Стан на {year} р.
              </span>
            )}
          </div>

          {version?.image_url && (
            <button type="button" onClick={() => setLightbox(true)} className="block w-full">
              <img src={version.image_url} alt="" loading="lazy" className="h-48 w-full rounded-lg border border-border object-cover" />
            </button>
          )}

          {version?.description && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-text">
              <SmartTextReader text={version.description} />
            </div>
          )}

          {isGm && version?.gm_note && (
            <div className="rounded-lg border border-gold/50 bg-gold/10 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gold">Нотатка майстра</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{version.gm_note}</p>
            </div>
          )}

          {!version?.description && !version?.image_url && !(isGm && version?.gm_note) && (
            <p className="text-sm text-text-dim">Опис відсутній.</p>
          )}

          {isGm && (
            <div className="mt-1 flex flex-wrap gap-2 border-t border-border pt-3">
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}><Pencil size={14} /> Редагувати</Button>
              {pin && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => onEditPin?.(pin)}>
                    <SlidersHorizontal size={14} /> Видимість мітки
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onRemovePin?.(pin.id)}>
                    <MapPin size={14} /> Прибрати мітку
                  </Button>
                </>
              )}
              <Button variant="danger" size="sm" onClick={() => { if (confirm('Видалити локацію разом з усіма її мітками?')) onDeleteLocation?.(locationId); }}>
                <Trash2 size={14} /> Видалити локацію
              </Button>
            </div>
          )}
        </div>
      )}

      {lightbox && version?.image_url && (
        <Lightbox images={[version.image_url]} index={0} onClose={() => setLightbox(false)} />
      )}

      {editing && (
        <LocationEditor
          location={location}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            const fresh = await load();
            onLocationUpdated?.(fresh);
          }}
        />
      )}
    </div>
  );
}
