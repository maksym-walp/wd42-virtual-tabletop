import { LayoutGrid, List } from 'lucide-react';

export default function ViewToggle({ mode, onChange }) {
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={() => onChange('cards')}
        aria-label="Картки"
        aria-pressed={mode === 'cards'}
        className={`flex min-h-11 items-center justify-center px-3 ${mode === 'cards' ? 'bg-accent text-bg' : 'bg-surface text-text-dim'}`}
      >
        <LayoutGrid size={16} />
      </button>
      <button
        type="button"
        onClick={() => onChange('table')}
        aria-label="Таблиця"
        aria-pressed={mode === 'table'}
        className={`flex min-h-11 items-center justify-center border-l border-border px-3 ${mode === 'table' ? 'bg-accent text-bg' : 'bg-surface text-text-dim'}`}
      >
        <List size={16} />
      </button>
    </div>
  );
}
