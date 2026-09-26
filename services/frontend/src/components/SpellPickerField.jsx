import { useState } from 'react';
import { X } from 'lucide-react';
import { inputClass } from './ui/Field';

// Вибір заклинань пошуком за назвою — для «Потрібно вивчити» (single: не
// більше одного) і «Похідних заклинань». Обрані показуються чіпами;
// lockedIds — обрані, які користувач не може прибрати (чужі похідні).
//
// props: { options, value: id[], onChange(ids), single, lockedIds, placeholder, describe(spell) }
// describe — необов'язковий короткий підпис біля варіанта в підказках.
export default function SpellPickerField({
  options, value, onChange, single = false, lockedIds = [], placeholder = 'Пошук заклинання...', describe,
}) {
  const [query, setQuery] = useState('');
  const byId = new Map(options.map((s) => [s.id, s]));
  const trimmed = query.trim().toLowerCase();

  const suggestions = trimmed
    ? options
      .filter((s) => !value.includes(s.id) && s.name.toLowerCase().includes(trimmed))
      .slice(0, 8)
    : [];

  const pick = (id) => {
    onChange(single ? [id] : [...value, id]);
    setQuery('');
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const locked = lockedIds.includes(id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded border border-accent/60 bg-accent/10 px-2.5 py-1 text-sm font-semibold text-accent"
                title={locked ? 'Заклинання іншого автора — відчепити його може лише автор' : undefined}
              >
                {byId.get(id)?.name ?? '(недоступне)'}
                {!locked && (
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((x) => x !== id))}
                    className="text-accent/70 hover:text-accent"
                    aria-label="Прибрати"
                  >
                    <X size={14} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {(!single || value.length === 0) && (
        <input
          type="text"
          className={inputClass}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
        />
      )}

      {suggestions.length > 0 && (
        <div className="max-h-[200px] overflow-y-auto rounded-md border border-border bg-bg">
          {suggestions.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => pick(s.id)}
              className="flex w-full items-center justify-between gap-3 border-b border-border/50 px-3 py-1.5 text-left text-sm text-text-muted last:border-0 hover:text-accent"
            >
              <span>{s.name}</span>
              {describe?.(s) && <span className="text-xs italic text-text-dim">{describe(s)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
