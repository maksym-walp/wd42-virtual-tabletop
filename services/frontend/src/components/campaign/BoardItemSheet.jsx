import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import Field, { inputClass } from '../ui/Field';
import SmartTextarea from '../ui/SmartTextarea';
import SmartTextReader from '../SmartTextReader';
import CroppedImage from '../ui/CroppedImage';
import { BOARD_KINDS, kindLabel } from './boardKinds';

// Повна картка запису. Гравець бачить лише знімок (назва, зображення, опис);
// майстер може поправити текст картки, перечитати її з джерела, відкрити
// джерело та посунути запис у порядку (на тач-екранах перетягування немає).
export default function BoardItemSheet({
  item, manager, campaignId, onClose, onSave, onRefresh, onMove,
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!item) return;
    setTitle(item.title ?? '');
    setContent(item.content ?? '');
    setEditing(false);
    setError('');
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;

  const kind = BOARD_KINDS[item.kind];
  const sourceHref = manager && item.ref_id && kind?.href ? kind.href(item, campaignId) : null;

  const run = async (fn, failMessage) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      return true;
    } catch (err) {
      setError(err.response?.data?.message || failMessage);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { setError('Вкажіть назву'); return; }
    const ok = await run(() => onSave(item, { title: title.trim(), content }), 'Не вдалось зберегти запис');
    if (ok) setEditing(false);
  };

  const handleRefresh = async () => {
    const ok = await run(async () => {
      const updated = await onRefresh(item);
      setTitle(updated.title ?? '');
      setContent(updated.content ?? '');
    }, 'Не вдалось оновити з джерела');
    if (ok) setEditing(false);
  };

  return (
    <Sheet open onClose={onClose} size="lg" title={kindLabel(item)}>
      <div className="flex flex-col gap-4">
        {item.image_url && (
          <div className="aspect-[16/9] w-full overflow-hidden rounded-lg bg-bg">
            <CroppedImage src={item.image_url} crop={item.image_crop} alt={item.title} />
          </div>
        )}

        {editing ? (
          <>
            <Field label="Назва">
              <input className={inputClass} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <SmartTextarea label="Текст картки" rows={8} value={content} onChange={(e) => setContent(e.target.value)} />
          </>
        ) : (
          <div>
            <h3 className="font-display text-2xl text-accent">{item.title}</h3>
            {item.subtitle && <p className="mt-0.5 text-sm italic text-text-dim">{item.subtitle}</p>}
            {item.content ? (
              <SmartTextReader text={item.content} className="mt-3 text-sm text-text" />
            ) : (
              <p className="mt-3 text-sm text-text-dim">Без опису.</p>
            )}
          </div>
        )}

        {item.kind === 'map' && (
          <Button to={BOARD_KINDS.map.href(item, campaignId)} size="sm" className="self-start">
            Відкрити мапу
          </Button>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {manager && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {onMove && (
              <>
                <Button variant="ghost" size="sm" onClick={() => onMove(item, -1)} aria-label="Посунути раніше">
                  <ArrowUp size={14} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onMove(item, 1)} aria-label="Посунути далі">
                  <ArrowDown size={14} />
                </Button>
              </>
            )}
            {sourceHref && item.kind !== 'map' && (
              <Button variant="ghost" size="sm" to={sourceHref}>
                <ExternalLink size={14} /> Джерело
              </Button>
            )}
            {item.ref_id && (
              <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={busy}>
                <RefreshCw size={14} /> Оновити з джерела
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              {editing ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={busy}>Скасувати</Button>
                  <Button size="sm" onClick={handleSave} disabled={busy}>{busy ? 'Збереження...' : 'Зберегти'}</Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Редагувати</Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
