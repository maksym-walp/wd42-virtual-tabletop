import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import mediaApi, { MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '../../api/media';
import { useMarkerTypes } from '../../context/MarkerTypesContext';
import { inputClass } from '../ui/Field';
import Button from '../ui/Button';

// Controlled editor for a location's fields, shared by PinForm (new location)
// and LocationDrawer (edit). value = { name, type, description, gm_note, image_url }.
export default function LocationFields({ value, onChange }) {
  const mt = useMarkerTypes();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => onChange({ ...value, ...patch });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { setError('Файл завеликий — максимум 25 МБ'); return; }
    setError('');
    setUploading(true);
    try {
      const url = await mediaApi.upload(file, { entityType: 'location' });
      set({ image_url: url });
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось завантажити зображення');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        className={inputClass}
        placeholder="Назва*"
        value={value.name}
        onChange={(e) => set({ name: e.target.value })}
        maxLength={200}
      />
      <select className={inputClass} value={value.type || ''} onChange={(e) => set({ type: e.target.value || null })}>
        <option value="">Без типу</option>
        {mt.types.map((t) => (
          <option key={t.key} value={t.key}>{`${t.emoji ? `${t.emoji} ` : ''}${t.label} · рівень ${t.level}`}</option>
        ))}
      </select>
      <textarea
        className={`${inputClass} resize-y`}
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
      <div className="flex items-center gap-3">
        {value.image_url && (
          <img src={value.image_url} alt="" className="h-14 w-14 rounded border border-border object-cover" />
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload size={14} /> {uploading ? 'Завантаження…' : (value.image_url ? 'Змінити зображення' : 'Зображення')}
        </Button>
        <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={handleUpload} />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
