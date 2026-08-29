import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import mediaApi, { MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '../../api/media';
import { isIconUrl, DEFAULT_MARKER_LEVEL } from '../../constants/maps';
import { inputClass } from '../ui/Field';
import Button from '../ui/Button';
import MarkerIcon from './MarkerIcon';

// Controlled editor for a location's BASE (time-invariant) fields:
// value = { name, type, marker_icon, marker_level }. The time-varying lore
// (description, gm_note, image) lives on chronological versions — see
// LocationVersionFields. The marker icon is either an uploaded image URL or an
// emoji glyph.
export default function LocationFields({ value, onChange }) {
  const markerRef = useRef(null);
  const [markerUploading, setMarkerUploading] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => onChange({ ...value, ...patch });

  const upload = async (file, entityType, apply, setBusy) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { setError('Файл завеликий — максимум 25 МБ'); return; }
    setError('');
    setBusy(true);
    try {
      apply(await mediaApi.upload(file, { entityType }));
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось завантажити зображення');
    } finally {
      setBusy(false);
    }
  };

  const effectiveLevel = value.marker_level ?? DEFAULT_MARKER_LEVEL;
  // The emoji field only reflects marker_icon when it isn't an image URL.
  const emojiValue = isIconUrl(value.marker_icon) ? '' : (value.marker_icon || '');

  return (
    <div className="flex flex-col gap-3">
      <input className={inputClass} placeholder="Назва*" value={value.name} onChange={(e) => set({ name: e.target.value })} maxLength={200} />

      <input className={inputClass} placeholder="Тип / категорія (для фільтра, необовʼязково)" value={value.type || ''} onChange={(e) => set({ type: e.target.value || null })} maxLength={50} />

      {/* Marker icon + zoom level */}
      <div className="rounded-lg border border-border p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Іконка мітки на мапі</p>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded border border-border bg-bg">
            <MarkerIcon icon={value.marker_icon} size={26} />
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => markerRef.current?.click()} disabled={markerUploading}>
            <Upload size={14} /> {markerUploading ? 'Завантаження…' : 'Своя іконка'}
          </Button>
          <div className="flex items-center gap-1.5">
            <input
              className={`${inputClass} w-24 text-center`}
              placeholder="😀 emoji"
              value={emojiValue}
              onChange={(e) => set({ marker_icon: e.target.value || null })}
              maxLength={8}
            />
          </div>
          {value.marker_icon && (
            <button type="button" onClick={() => set({ marker_icon: null })} className="text-xs text-text-dim hover:text-danger">
              Очистити
            </button>
          )}
          <input
            ref={markerRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f, 'marker-icon', (url) => set({ marker_icon: url }), setMarkerUploading); }}
          />
        </div>
        <p className="mb-3 text-xs text-text-dim">Своя іконка: PNG, SVG або WebP · прозорий фон · рекомендовано ~64×64 px. Або встав emoji.</p>

        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Рівень видимості (масштаб)</p>
        <div className="flex gap-1">
          {[4, 3, 2, 1].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => set({ marker_level: lvl })}
              className={`h-8 w-8 rounded border text-sm font-semibold ${effectiveLevel === lvl ? 'border-gold bg-gold/20 text-gold' : 'border-border text-text-dim hover:bg-surface-hover'}`}
            >
              {lvl}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-text-dim">4 — видно на всіх масштабах · 1 — лише при значному приближенні.</p>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
