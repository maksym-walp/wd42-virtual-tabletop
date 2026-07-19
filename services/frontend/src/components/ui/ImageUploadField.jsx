import { useRef, useState } from 'react';
import { Upload, ImagePlus, Trash2 } from 'lucide-react';
import mediaApi, { MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '../../api/media';
import { inputClass } from './Field';

/**
 * Головний спосіб задати зображення — завантажити файл із пристрою.
 * Вставка URL лишається як другорядна, згорнута опція (сумісність із уже
 * введеними зовнішніми посиланнями).
 *
 * Свідомо НЕ загорнуто у <Field>: той рендерить <label> навколо дітей, а
 * <label> навколо file-інпута й текстового інпута дає хаотичні кліки.
 */
export default function ImageUploadField({
  value,
  onChange,
  entityType = 'item',
  entityId,
  label = 'Зображення',
  disabled = false,
}) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    // Скидаємо одразу, щоб повторний вибір того самого файлу знову спрацював.
    e.target.value = '';
    if (!file) return;

    setError('');

    if (file.size > MAX_UPLOAD_BYTES) {
      setError('Файл завеликий — максимум 10 МБ');
      return;
    }

    setUploading(true);
    try {
      const url = await mediaApi.upload(file, { entityType, entityId });
      onChange(url);
    } catch (err) {
      // nginx віддає 413 з HTML-тілом, тож data.message може не існувати.
      setError(err.response?.data?.message ?? 'Не вдалось завантажити зображення');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">
          {label}
        </span>
        {uploading && <span className="text-xs text-text-dim">• Завантаження...</span>}
      </div>

      <div className="flex items-start gap-3">
        {value ? (
          <img
            src={value}
            alt=""
            className="h-24 w-24 shrink-0 rounded-lg border border-border object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border text-text-dim">
            <ImagePlus size={22} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || uploading}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-3.5 text-xs font-semibold text-text transition-opacity hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload size={14} />
            {value ? 'Замінити' : 'Завантажити зображення'}
          </button>

          {value && (
            <button
              type="button"
              onClick={() => { setError(''); onChange(''); }}
              disabled={disabled || uploading}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg px-1 text-xs text-danger hover:underline disabled:opacity-50"
            >
              <Trash2 size={14} />
              Видалити
            </button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <details className="text-xs text-text-dim">
        <summary className="cursor-pointer select-none py-1">або вставте посилання</summary>
        <input
          type="text"
          className={`${inputClass} mt-1.5`}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          disabled={disabled || uploading}
        />
      </details>
    </div>
  );
}
