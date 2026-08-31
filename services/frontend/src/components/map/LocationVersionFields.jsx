import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import mediaApi, { MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '../../api/media';
import { isIconUrl } from '../../constants/maps';
import { inputClass } from '../ui/Field';
import Button from '../ui/Button';
import SmartTextarea from '../ui/SmartTextarea';
import MarkerIcon from './MarkerIcon';
import TypeTagsInput from './TypeTagsInput';

// Controlled editor for ONE chronological version of a location.
// value = { start_year, end_year, description, gm_note, image_url, name,
//           marker_icon, marker_level, types }.
// `isBase` (the undated base version): hides the year window and the
// name/marker/types overrides — those live on the location row itself.
export default function LocationVersionFields({ value, onChange, isBase = false }) {
  const fileRef = useRef(null);
  const markerRef = useRef(null);
  const [uploading, setUploading] = useState(false);
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

  const emojiValue = isIconUrl(value.marker_icon) ? '' : (value.marker_icon || '');
  // An undated version row is the "base" version — its name / marker / types
  // live on the location itself, so only offer the overrides once it's dated.
  const undated = value.start_year == null || value.start_year === '';
  const showOverrides = !isBase && !undated;

  return (
    <div className="flex flex-col gap-3">
      {!isBase && (
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Починаючи з</span>
            <input
              type="number"
              className={inputClass}
              placeholder="напр. 600"
              value={value.start_year ?? ''}
              onChange={(e) => set({ start_year: e.target.value === '' ? null : e.target.value })}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Завершення</span>
            <input
              type="number"
              className={inputClass}
              placeholder="Порожньо — без межі"
              value={value.end_year ?? ''}
              onChange={(e) => set({ end_year: e.target.value === '' ? null : e.target.value })}
              disabled={undated}
            />
          </label>
        </div>
      )}

      {showOverrides && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Назва в цей період</span>
          <input
            className={inputClass}
            placeholder="Порожньо — назва локації без змін"
            value={value.name || ''}
            onChange={(e) => set({ name: e.target.value || null })}
            maxLength={200}
          />
        </label>
      )}

      {showOverrides && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Типи в цей період</span>
            {value.types == null ? (
              <button type="button" onClick={() => set({ types: [] })} className="text-xs text-accent hover:opacity-80">Змінити</button>
            ) : (
              <button type="button" onClick={() => set({ types: null })} className="text-xs text-text-dim hover:text-accent">↺ як у локації</button>
            )}
          </div>
          {value.types == null
            ? <p className="text-xs text-text-dim">Типи локації без змін.</p>
            : <TypeTagsInput value={value.types} onChange={(types) => set({ types })} />}
        </div>
      )}

      <SmartTextarea
        label="Опис"
        hint="Кнопкою «Посилання» вставте посилання — воно стане клікабельним у картці локації."
        rows={3}
        placeholder="Опис (бачать усі, хто відкриє локацію)"
        value={value.description || ''}
        onChange={(e) => set({ description: e.target.value })}
      />

      <textarea
        className={`${inputClass} resize-y`}
        rows={2}
        placeholder="Нотатка майстра (лише для вас)"
        value={value.gm_note || ''}
        onChange={(e) => set({ gm_note: e.target.value })}
      />

      <div>
        <p className="mb-1 text-xs text-text-dim">Зображення локації</p>
        <div className="flex flex-wrap items-center gap-2">
          {value.image_url && (
            <div className="relative">
              <img src={value.image_url} alt="" className="h-16 w-16 rounded border border-border object-cover" />
              <button type="button" onClick={() => set({ image_url: null })} aria-label="Видалити зображення" className="absolute -right-1.5 -top-1.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80">
                <X size={12} />
              </button>
            </div>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload size={14} /> {uploading ? 'Завантаження…' : (value.image_url ? 'Замінити' : 'Додати зображення')}
          </Button>
        </div>
        <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f, 'location', (url) => set({ image_url: url }), setUploading); }} />
      </div>

      {showOverrides && (
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Іконка мітки в цей період</p>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded border border-border bg-bg">
              <MarkerIcon icon={value.marker_icon} size={26} />
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => markerRef.current?.click()} disabled={markerUploading}>
              <Upload size={14} /> {markerUploading ? 'Завантаження…' : 'Своя іконка'}
            </Button>
            <input
              className={`${inputClass} w-24 text-center`}
              placeholder="😀 emoji"
              value={emojiValue}
              onChange={(e) => set({ marker_icon: e.target.value || null })}
              maxLength={8}
            />
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
          <p className="mb-2 text-xs text-text-dim">Порожньо — іконка локації без змін.</p>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Рівень видимості</p>
          <div className="flex gap-1">
            {[4, 3, 2, 1].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => set({ marker_level: value.marker_level === lvl ? null : lvl })}
                className={`h-8 w-8 rounded border text-sm font-semibold ${value.marker_level === lvl ? 'border-gold bg-gold/20 text-gold' : 'border-border text-text-dim hover:bg-surface-hover'}`}
              >
                {lvl}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-text-dim">Порожньо — рівень локації без змін.</p>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
