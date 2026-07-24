import { SlidersHorizontal, ChevronDown } from 'lucide-react';

export default function FilterToggleButton({ open, onClick, activeCount = 0 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-text"
    >
      <SlidersHorizontal size={16} /> Фільтри
      <ChevronDown size={14} className={`text-text-dim transition-transform ${open ? 'rotate-180' : ''}`} />
      {activeCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[0.65rem] font-bold text-bg">
          {activeCount}
        </span>
      )}
    </button>
  );
}
