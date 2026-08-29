import { useRef, useState } from 'react';
import { Trash2, Upload, Check } from 'lucide-react';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import Field, { inputClass } from '../ui/Field';
import mapsApi from '../../api/maps';
import mediaApi, { MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '../../api/media';

// GM tool: manage a lens's dated image versions (its timeline). A version's
// year may be blank — that's the lens's "timeless" fallback image, shown
// whenever the view has no active year.
export default function LensVersionsSheet({ mapId, lens, onChanged, onClose }) {
  const versions = lens.versions || [];
  const fileRef = useRef(null);
  const [newYear, setNewYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [yearDrafts, setYearDrafts] = useState({}); // versionId -> string

  const parseYear = (raw) => {
    const s = String(raw).trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isInteger(n) ? n : NaN;
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { setError('Файл завеликий — максимум 25 МБ'); return; }
    const year = parseYear(newYear);
    if (Number.isNaN(year)) { setError('Рік має бути цілим числом'); return; }

    setError('');
    setBusy(true);
    try {
      const image_url = await mediaApi.upload(file, { entityType: 'map-lenses', entityId: mapId });
      await mapsApi.addLensVersion(mapId, lens.id, { year, image_url });
      setNewYear('');
      await onChanged();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось додати версію');
    } finally {
      setBusy(false);
    }
  };

  const saveYear = async (version) => {
    const draft = yearDrafts[version.id];
    if (draft === undefined) return;
    const year = parseYear(draft);
    if (Number.isNaN(year)) { setError('Рік має бути цілим числом'); return; }
    setError('');
    setBusy(true);
    try {
      await mapsApi.updateLensVersion(mapId, lens.id, version.id, { year, image_url: version.image_url });
      setYearDrafts((d) => { const next = { ...d }; delete next[version.id]; return next; });
      await onChanged();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось зберегти рік');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (version) => {
    if (!confirm('Видалити цю версію шару?')) return;
    setError('');
    setBusy(true);
    try {
      await mapsApi.removeLensVersion(mapId, lens.id, version.id);
      await onChanged();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось видалити версію');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={`Часова шкала — ${lens.name}`}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-dim">
          Кожна версія — зображення шару для певного року. Порожній рік — «позачасове»
          зображення, яке показується, коли активного року немає.
        </p>

        <div className="flex flex-col gap-2">
          {versions.map((v) => {
            const draft = yearDrafts[v.id] ?? (v.year == null ? '' : String(v.year));
            const dirty = yearDrafts[v.id] !== undefined && yearDrafts[v.id] !== (v.year == null ? '' : String(v.year));
            return (
              <div key={v.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <img src={v.image_url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                <input
                  type="number"
                  className={`${inputClass} min-h-9 py-1`}
                  value={draft}
                  placeholder="Позачасове"
                  onChange={(e) => setYearDrafts((d) => ({ ...d, [v.id]: e.target.value }))}
                />
                {dirty && (
                  <button onClick={() => saveYear(v)} disabled={busy} aria-label="Зберегти рік" className="p-1.5 text-sage">
                    <Check size={16} />
                  </button>
                )}
                <button
                  onClick={() => remove(v)}
                  disabled={busy || versions.length <= 1}
                  aria-label="Видалити версію"
                  className="p-1.5 text-text-dim hover:text-danger disabled:opacity-40"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <Field label="Додати версію" hint="Рік необовʼязковий — залиште порожнім для позачасового зображення.">
          <div className="flex items-center gap-2">
            <input
              type="number"
              className={inputClass}
              value={newYear}
              placeholder="Рік"
              onChange={(e) => setNewYear(e.target.value)}
            />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload size={14} /> {busy ? '…' : 'Зображення'}
            </Button>
          </div>
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={handleUpload} />
      </div>
    </Sheet>
  );
}
