import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { inputClass } from '../ui/Field';
import { SidebarSection } from './CatalogLayout';

// Сортування каталогу окремо від меню фільтрів. dir/onDirChange —
// необов'язкові: для каталогів із серверним напрямом (спорядження).
export default function SortSelect({ options, value, onChange, dir, onDirChange, label = 'Сортування' }) {
  return (
    <SidebarSection label={label}>
      <div className="flex gap-2">
        <select className={`${inputClass} min-w-0 flex-1`} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {onDirChange && (
          <button
            type="button"
            onClick={() => onDirChange(dir === 'desc' ? 'asc' : 'desc')}
            className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-dim hover:text-text"
            aria-label={dir === 'desc' ? 'За спаданням' : 'За зростанням'}
            title={dir === 'desc' ? 'За спаданням' : 'За зростанням'}
          >
            {dir === 'desc' ? <ArrowDownWideNarrow size={17} /> : <ArrowUpNarrowWide size={17} />}
          </button>
        )}
      </div>
    </SidebarSection>
  );
}
