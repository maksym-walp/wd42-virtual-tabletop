import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { inputClass } from './Field';

// Closed-by-default dropdown for picking several values out of a fixed list
// (e.g. weapon grips) — a native <select multiple> renders as an always-open
// listbox, which doesn't fit a form laid out around single-line fields, and
// an always-open checkbox list takes space even when unused. This stays
// collapsed to one line until opened, same overlay-close pattern as the
// Navbar/BottomNav dropdowns (fixed inset-0 + onClick).
//
// The popover is portaled into document.body instead of living inline: an
// inline `absolute` popover gets clipped by the first ancestor with
// `overflow-hidden` (e.g. EquipmentForm's FormSection card), which cut the
// checkbox list off mid-list. Portaling escapes that entirely; position is
// tracked via the trigger button's live viewport rect (recomputed on
// scroll/resize while open) since `fixed` positioning no longer benefits
// from the button's own offset parent.
export default function MultiSelectDropdown({ options, value, onChange, placeholder = 'Не обрано' }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const updateRect = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom + 6, left: r.left, width: r.width });
    };
    updateRect();
    // capture: true — #app-scroll (the actual scrolling element) doesn't
    // bubble its own 'scroll' event, but capture-phase listening on window
    // still sees it on the way down to the target.
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [open]);

  const toggle = (key) => {
    onChange(value.includes(key) ? value.filter((v) => v !== key) : [...value, key]);
  };

  const label = value.length
    ? options.filter((o) => value.includes(o.key)).map((o) => o.label).join(', ')
    : placeholder;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`${inputClass} flex items-center justify-between gap-2 text-left ${value.length ? 'text-text' : 'text-text-dim'}`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={16} className={`shrink-0 text-text-dim transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && rect && createPortal(
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="fixed z-40 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface shadow-xl"
            style={{ top: rect.top, left: rect.left, width: rect.width }}
          >
            {options.map((o) => (
              <label
                key={o.key}
                className="flex cursor-pointer items-center gap-2.5 border-b border-border px-3.5 py-2.5 text-sm text-text last:border-b-0 hover:bg-surface-hover"
              >
                <input
                  type="checkbox"
                  checked={value.includes(o.key)}
                  onChange={() => toggle(o.key)}
                  className="h-4 w-4 accent-accent"
                />
                {o.label}
              </label>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
