import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import mediaApi, { MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '../../api/media';

// Компактне поле зображення: клік по рамці — вибрати файл, хрестик — прибрати.
// Для рядів масті й карт, де повний ImageUploadField (превʼю + три кнопки +
// посилання) був би надто громіздким. Тип завантаження — 'deck-card'.
// className задає розмір рамки (w-16 aspect-[2/3]...).
export default function ImageSlot({ value, onChange, label = 'Зображення', className = 'w-20 aspect-[2/3]' }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { setError('Файл завеликий (макс. 25 МБ)'); return; }
    setError('');
    setUploading(true);
    try {
      const { image_url } = await mediaApi.uploadWithThumbnail(file, { entityType: 'deck-card' });
      onChange(image_url);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Не вдалось завантажити');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="shrink-0">
      <div className={`relative overflow-hidden rounded-lg border border-border ${className}`}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label={value ? `${label}: замінити` : `${label}: завантажити`}
          title={value ? 'Замінити зображення' : 'Завантажити зображення'}
          className="flex h-full w-full items-center justify-center bg-bg text-text-dim hover:bg-surface-hover disabled:opacity-60"
        >
          {value
            ? <img src={value} alt="" draggable={false} className="h-full w-full object-cover" />
            : <ImagePlus size={20} />}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`${label}: прибрати`}
            className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
          >
            <X size={12} />
          </button>
        )}
        {uploading && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[0.65rem] text-white">...</span>}
      </div>
      {error && <p className="mt-1 max-w-[7rem] text-[0.65rem] leading-tight text-danger">{error}</p>}
      <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={handleFile} />
    </div>
  );
}
