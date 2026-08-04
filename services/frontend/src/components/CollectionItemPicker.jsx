import { useState } from 'react';
import { inputClass } from './ui/Field';

// Filterable, checkbox-based multi-select over a catalog — the shared list
// used both by CollectionForm (picking items while creating a collection,
// before it has an id to POST items against) and CollectionView's "Додати"
// sheet (picking items to add to an existing one). Checkboxes replace the
// old one-click "+" per row so several items can be picked, unpicked, and
// re-picked before anything is actually sent to the server.
export default function CollectionItemPicker({ items, selectedIds, onToggle, itemMeta, placeholder = 'Пошук...' }) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? items.filter((i) => i.name?.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        className={`${inputClass} text-sm`}
        placeholder={placeholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="max-h-[320px] overflow-y-auto rounded-md border border-border">
        {filtered.length === 0 && (
          <p className="px-3.5 py-3 text-sm text-text-dim">Нічого не знайдено</p>
        )}
        {filtered.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-center gap-3 border-b border-border/50 px-3.5 py-2.5 text-left last:border-0 hover:bg-surface-hover"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(item.id)}
              onChange={() => onToggle(item.id)}
              className="h-5 w-5 shrink-0 accent-accent"
            />
            <span className="flex flex-1 flex-col">
              <span className="text-sm text-text">{item.name}</span>
              {itemMeta?.(item) && <span className="text-xs text-text-dim">{itemMeta(item)}</span>}
            </span>
          </label>
        ))}
      </div>

      {selectedIds.length > 0 && (
        <p className="text-xs font-semibold text-text-dim">Обрано: {selectedIds.length}</p>
      )}
    </div>
  );
}
