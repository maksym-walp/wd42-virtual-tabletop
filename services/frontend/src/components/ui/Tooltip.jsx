import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MAX_W = 280;
const MARGIN = 8;
const GAP = 6;

// Підказка при наведенні/фокусі: обгортає будь-який елемент і показує `text`
// у картці порталом (батьківський блок може обрізати overflow-ом). Без
// тексту просто рендерить дітей — тож можна обгортати безумовно. Не
// інтерактивна (pointer-events none), щоб не перехоплювати курсор.
export default function Tooltip({ text, children, className = '' }) {
  const anchorRef = useRef(null);
  const cardRef = useRef(null);
  const [anchor, setAnchor] = useState(null);
  const [pos, setPos] = useState(null);

  const show = () => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (r) setAnchor({ left: r.left, top: r.top, bottom: r.bottom });
  };
  const hide = () => { setAnchor(null); setPos(null); };

  useLayoutEffect(() => {
    if (!anchor) return;
    const h = cardRef.current?.offsetHeight ?? 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(MARGIN, Math.min(anchor.left, vw - MAX_W - MARGIN));
    const below = anchor.bottom + GAP;
    const top = below + h + MARGIN <= vh ? below : Math.max(MARGIN, anchor.top - h - GAP);
    setPos({ left, top });
  }, [anchor, text]);

  if (!text) return <span className={className}>{children}</span>;

  return (
    <span
      ref={anchorRef}
      className={`inline-flex ${className}`}
      onMouseEnter={show} onMouseLeave={hide}
      onFocus={show} onBlur={hide}
    >
      {children}
      {anchor && createPortal(
        <div
          ref={cardRef}
          role="tooltip"
          className="fixed z-[70] whitespace-pre-line rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm font-normal normal-case tracking-normal text-text shadow-xl"
          style={{
            width: 'max-content',
            maxWidth: MAX_W,
            left: pos?.left ?? -9999,
            top: pos?.top ?? 0,
            visibility: pos ? 'visible' : 'hidden',
            pointerEvents: 'none',
          }}
        >
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}
