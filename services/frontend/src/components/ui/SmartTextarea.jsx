import { useLayoutEffect, useRef, useState } from 'react';
import { Dices, Link2 } from 'lucide-react';
import Field, { inputClass } from './Field';
import Button from './Button';
import Sheet from './Sheet';

const labelClass = 'text-xs font-semibold uppercase tracking-wide text-text-dim';
const hintClass = 'text-xs text-text-dim';

function insertAtCursor(value, insertText, start, end) {
  return {
    newValue: value.slice(0, start) + insertText + value.slice(end),
    cursorPos: start + insertText.length,
  };
}

// Textarea with a toolbar for inserting `[[formula]]` dice-roll tags and
// `[Text](URL)` links at the cursor. Paired with SmartTextReader, which
// renders the same raw string back as clickable badges/links.
export default function SmartTextarea({
  label, hint, className = '', value, onChange, rows = 4, placeholder,
}) {
  const textareaRef = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const cursorRef = useRef({ start: 0, end: 0 });
  // Cursor position to restore once `value` has actually reached the
  // textarea's DOM node. A plain requestAnimationFrame callback fires on
  // the next paint, which leaves a window where a fast subsequent
  // keystroke lands before the cursor jump — producing e.g. "[[d8+3]]2"
  // instead of "[[2d8+3]]". useLayoutEffect runs synchronously right
  // after React commits the new value, closing that window.
  const [pendingCursor, setPendingCursor] = useState(null);

  useLayoutEffect(() => {
    if (pendingCursor == null) return;
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(pendingCursor, pendingCursor);
    }
    setPendingCursor(null);
  }, [value, pendingCursor]);

  const emit = (newValue) => onChange({ target: { value: newValue } });

  const handleInsertDice = () => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const { newValue } = insertAtCursor(value, '[[]]', start, end);
    emit(newValue);
    setPendingCursor(start + 2);
  };

  const handleOpenLink = () => {
    const el = textareaRef.current;
    cursorRef.current = {
      start: el?.selectionStart ?? value.length,
      end: el?.selectionEnd ?? value.length,
    };
    setLinkText('');
    setLinkUrl('');
    setLinkOpen(true);
  };

  const handleConfirmLink = () => {
    const { start, end } = cursorRef.current;
    const tag = `[${linkText || linkUrl}](${linkUrl})`;
    const { newValue, cursorPos } = insertAtCursor(value, tag, start, end);
    emit(newValue);
    setLinkOpen(false);
    setPendingCursor(cursorPos);
  };

  return (
    <>
      {/* Not a <Field>/<label>: it would wrap the toolbar buttons and the
          textarea together, and clicking the caption would forward the
          click to the first <button> (dice) instead of focusing the
          textarea. Plain <div> replicates Field's look without that. */}
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {label && <span className={labelClass}>{label}</span>}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleInsertDice}>
            <Dices size={14} /> Кубик
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={handleOpenLink}>
            <Link2 size={14} /> Посилання
          </Button>
        </div>
        <textarea
          ref={textareaRef}
          className={`${inputClass} resize-y`}
          value={value}
          onChange={(e) => emit(e.target.value)}
          rows={rows}
          placeholder={placeholder}
        />
        {hint && <span className={hintClass}>{hint}</span>}
      </div>

      <Sheet open={linkOpen} onClose={() => setLinkOpen(false)} title="Вставити посилання">
        <div className="flex flex-col gap-4">
          <Field label="Текст для відображення">
            <input
              type="text"
              className={inputClass}
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="напр. Вогняна куля"
            />
          </Field>
          <Field label="URL">
            <input
              type="text"
              className={inputClass}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setLinkOpen(false)}>Скасувати</Button>
            <Button type="button" variant="primary" onClick={handleConfirmLink} disabled={!linkUrl}>
              Додати
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
