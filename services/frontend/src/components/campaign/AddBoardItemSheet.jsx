import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Plus, Search, Upload } from 'lucide-react';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import Field, { inputClass } from '../ui/Field';
import SmartTextarea from '../ui/SmartTextarea';
import ImageUploadField from '../ui/ImageUploadField';
import mediaApi, { MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '../../api/media';
import { BOARD_KINDS, BOARD_KIND_ORDER } from './boardKinds';

const MEDIA_ENTITY = 'campaign-gallery';

// Вибір запису каталогу: пошук за назвою по списку, який повертає
// сервіс-власник (лише доступні користувачеві записи).
function CatalogPicker({ kind, existingRefIds, onPick }) {
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    BOARD_KINDS[kind].load()
      .then((rows) => { if (alive) setEntries(rows); })
      .catch(() => { if (alive) setError('Не вдалось завантажити список'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [kind]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => !q || e.name?.toLowerCase().includes(q))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'uk'));
  }, [entries, query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
        <input
          className={`${inputClass} pl-9`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Пошук за назвою…"
          autoFocus
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {loading ? (
        <p className="text-sm text-text-dim">Завантаження...</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-text-dim">Нічого не знайдено.</p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {shown.map((entry) => {
            const already = kind === 'map' && existingRefIds.has(entry.id);
            return (
              <li key={`${entry.subtype ?? ''}${entry.id}`}>
                <button
                  type="button"
                  disabled={already}
                  onClick={() => onPick(entry)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm text-text hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="truncate">{entry.name}</span>
                  <span className="shrink-0 text-xs text-text-dim">
                    {already ? 'вже додано' : entry.hint}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Завантаження одного чи кількох зображень — кожне стає окремим записом.
function ImagesForm({ campaignId, onAdd, onDone }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;

    setError('');
    setUploading(true);
    let added = 0;
    try {
      // Послідовно: помилка на одному файлі не губить уже завантажених.
      for (const file of files) {
        if (file.size > MAX_UPLOAD_BYTES) {
          setError(`«${file.name}» завеликий — максимум ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} МБ`);
          continue;
        }
        const url = await mediaApi.upload(file, { entityType: MEDIA_ENTITY, entityId: campaignId });
        await onAdd({ kind: 'image', image_url: url });
        added += 1;
      }
      if (added === files.length) onDone();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Не вдалось завантажити зображення');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-dim">Кожне зображення стане окремою карткою — сцени, портрети, листи, мапи місцевості.</p>
      <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="self-start">
        <Upload size={15} /> {uploading ? 'Завантаження...' : 'Обрати файли'}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
      <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} multiple className="hidden" onChange={handleFiles} />
    </div>
  );
}

// Нотатка або довільна картка майстра.
function TextForm({ kind, campaignId, onAdd, onDone }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Вкажіть назву'); return; }
    setSaving(true);
    setError('');
    try {
      await onAdd({ kind, title: title.trim(), content, image_url: imageUrl || undefined });
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось додати запис');
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label="Назва">
        <input className={inputClass} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </Field>
      {kind === 'custom' && (
        <ImageUploadField
          value={imageUrl}
          onChange={(url) => setImageUrl(url || '')}
          entityType={MEDIA_ENTITY}
          entityId={campaignId}
        />
      )}
      <SmartTextarea label="Текст" rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button onClick={handleSubmit} disabled={saving} className="self-end">
        <Plus size={15} /> {saving ? 'Додавання...' : 'Додати'}
      </Button>
    </div>
  );
}

export default function AddBoardItemSheet({ open, zone, campaignId, existingItems, onAdd, onClose }) {
  const [kind, setKind] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setKind(null); setError(''); } }, [open]);

  const existingRefIds = useMemo(
    () => new Set((existingItems ?? []).filter((i) => i.kind === 'map').map((i) => i.ref_id)),
    [existingItems],
  );

  if (!open) return null;

  const handlePick = async (entry) => {
    setBusy(true);
    setError('');
    try {
      await onAdd({ kind, ref_id: entry.id, ref_subtype: entry.subtype });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось додати запис');
    } finally {
      setBusy(false);
    }
  };

  const title = kind
    ? `${zone === 'screen' ? 'На Ширму' : 'На Стіл'}: ${BOARD_KINDS[kind].label.toLowerCase()}`
    : (zone === 'screen' ? 'Додати на Ширму' : 'Додати на Стіл');

  return (
    <Sheet open onClose={onClose} size="lg" title={title}>
      {!kind ? (
        <div className="flex flex-col gap-3">
          {zone === 'table' && (
            <p className="text-sm text-text-dim">Новий запис з'являється на Столі захованим — відкрийте його гравцям, коли буде час.</p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BOARD_KIND_ORDER.map((key) => {
              const { label, icon: Icon } = BOARD_KINDS[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setKind(key)}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-3 text-left text-sm text-text hover:border-accent/50 hover:bg-surface-hover"
                >
                  <Icon size={16} className="shrink-0 text-accent" /> {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <button type="button" onClick={() => setKind(null)} className="inline-flex items-center gap-1 self-start text-sm text-text-dim hover:text-text">
            <ArrowLeft size={14} /> Інший тип
          </button>
          {BOARD_KINDS[kind].source ? (
            <div className={busy ? 'pointer-events-none opacity-60' : ''}>
              <CatalogPicker kind={kind} existingRefIds={existingRefIds} onPick={handlePick} />
            </div>
          ) : kind === 'image' ? (
            <ImagesForm campaignId={campaignId} onAdd={onAdd} onDone={onClose} />
          ) : (
            <TextForm kind={kind} campaignId={campaignId} onAdd={onAdd} onDone={onClose} />
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </Sheet>
  );
}
