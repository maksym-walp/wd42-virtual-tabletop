import { useState } from 'react';
import { X } from 'lucide-react';

// Free-form multi-value tag input for location type keys. value: string[].
export default function TypeTagsInput({ value = [], onChange, placeholder = 'Тип, потім Enter…' }) {
  const [draft, setDraft] = useState('');

  const add = (raw) => {
    const t = raw.trim().slice(0, 50);
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  const remove = (t) => onChange(value.filter((x) => x !== t));

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-bg px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded bg-surface-hover px-1.5 py-0.5 text-xs text-text">
          {t}
          <button type="button" onClick={() => remove(t)} aria-label={`Прибрати ${t}`} className="text-text-dim hover:text-danger">
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        className="min-w-[6rem] flex-1 bg-transparent py-1 text-sm text-text placeholder:text-text-dim focus:outline-none"
        value={draft}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); }
          else if (e.key === 'Backspace' && !draft && value.length) remove(value[value.length - 1]);
        }}
        onBlur={() => { if (draft.trim()) add(draft); }}
      />
    </div>
  );
}
