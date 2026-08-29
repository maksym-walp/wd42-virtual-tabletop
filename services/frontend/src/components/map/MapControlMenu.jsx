import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// A compact map-overlay control: a labelled button that drops down a panel of
// content. Used on narrow screens so the lens and type-filter panels don't eat
// the map. Closes on outside click / Escape.
export default function MapControlMenu({ icon: Icon, label, children, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-lg backdrop-blur ${open ? 'border-gold/50 bg-surface text-gold' : 'border-border bg-surface/95 text-text-dim'}`}
      >
        <Icon size={14} />
        {label}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className={`absolute top-full z-10 mt-1 max-h-[60vh] w-max max-w-[80vw] overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
