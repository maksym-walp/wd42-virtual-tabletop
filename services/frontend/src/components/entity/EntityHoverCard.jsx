import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ENTITY_KINDS } from './entityRegistry';

const CARD_W = 320;
const MARGIN = 12;
const GAP = 6;

// Картка прев'ю запису під (або над) чіпом-посиланням. Рендериться порталом —
// батьківський блок може обрізати (overflow) чи лежати в Sheet. Не інтерактивна:
// pointer-events none, щоб курсор, який зійшов із чіпа, не «застрягав» на ній.
export default function EntityHoverCard({ kind, entry, status, anchor }) {
  const elRef = useRef(null);
  const [pos, setPos] = useState(null);
  const def = ENTITY_KINDS[kind];

  useLayoutEffect(() => {
    const h = elRef.current?.offsetHeight ?? 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(MARGIN, Math.min(anchor.left, vw - CARD_W - MARGIN));
    const below = anchor.bottom + GAP;
    let top = below + h + MARGIN <= vh ? below : anchor.top - h - GAP;
    top = Math.max(MARGIN, top);
    setPos({ left, top });
  }, [anchor, entry, status]);

  let content = null;
  if (status === 'ok' && entry) content = <def.Preview data={entry} />;
  else if (status === 'missing') {
    content = <p className="px-4 py-3 text-sm text-text-dim">Запис видалено або він більше не існує</p>;
  }
  if (!content) return null;

  return createPortal(
    <div
      ref={elRef}
      className="fixed z-[70] max-h-[80vh] overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
      style={{
        width: CARD_W,
        left: pos?.left ?? -9999,
        top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden',
        pointerEvents: 'none',
      }}
    >
      {content}
    </div>,
    document.body,
  );
}
