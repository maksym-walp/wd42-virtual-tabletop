import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import Button from './ui/Button';
import Sheet from './ui/Sheet';
import { inputClass } from './ui/Field';
import { useEntitySearch } from './entity/entitySearch';

// Рівноцінні / альтернативні заклинання чи вміння (міграція 118) —
// посилання на інший, самостійно заповнений запис того самого каталогу, а
// НЕ вбудована форма: кожен зв'язаний запис має власні traditions/
// complexity, і посилання саме по собі доступу до нього не дає (це
// перевіряється окремо при кастуванні/застосуванні). serviceKey — 'spellbook'
// чи 'abilities' (ключ з entitySearch.ENTITY_SERVICES), excludeId — id
// самого запису, що редагується (не можна послатися на себе).
export default function RelatedEntryPicker({ serviceKey, excludeId, value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { results, loading } = useEntitySearch({
    query, services: [serviceKey], limit: 20, minLen: 0, enabled: open,
  });

  const selectedIds = new Set(value.map((v) => v.id));
  const filtered = results.filter((r) => r.id !== excludeId && !selectedIds.has(r.id));

  const add = (r) => { onChange([...value, { id: r.id, name: r.name }]); setOpen(false); setQuery(''); };
  const remove = (id) => onChange(value.filter((v) => v.id !== id));

  return (
    <div>
      <p className="mb-3 text-xs text-text-dim">
        Посилання на інший, самостійно заповнений запис — не впливає на доступ до нього.
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {value.map((v) => (
          <span
            key={v.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text"
          >
            {v.name}
            <button type="button" onClick={() => remove(v.id)} className="text-text-dim hover:text-danger" aria-label={`Прибрати ${v.name}`}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} /> {label}
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <div className="flex flex-col gap-3">
          <input
            autoFocus type="text" className={inputClass} placeholder="Назва…"
            value={query} onChange={(e) => setQuery(e.target.value)}
          />
          <div role="listbox" className="max-h-[320px] overflow-y-auto rounded-md border border-border">
            {filtered.map((r) => (
              <button
                key={r.id} type="button" onClick={() => add(r)}
                className="block w-full px-3.5 py-2.5 text-left text-sm text-text hover:bg-surface-hover"
              >
                {r.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3.5 py-3 text-sm text-text-dim">{loading ? 'Шукаю…' : 'Нічого не знайдено'}</p>
            )}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
