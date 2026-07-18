// Source filter shared by every catalog (equipment/abilities/maneuvers/spells and
// their collections) and by the character-sheet add-item pickers:
//   ''          → all sources
//   'canonical' → authored by an admin ("канонічні")
//   'user'      → authored by anyone else ("користувацькі")
// Catalog pages pass the value straight to the list endpoint as ?scope=...;
// the pickers filter their already-loaded lists client-side via matchesScope.
export const SCOPE_OPTIONS = [
  { key: '',          label: 'Усі' },
  { key: 'canonical', label: 'Канонічні' },
  { key: 'user',      label: 'Користувацькі' },
];

export default function ScopeFilter({ scope, onChange, className = '', size = 'md' }) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm';
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {SCOPE_OPTIONS.map((o) => (
        <button
          key={o.key || 'all'}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded border font-semibold transition-colors ${pad} ${
            scope === o.key
              ? 'border-accent/60 bg-accent/10 text-accent'
              : 'border-border text-text-dim hover:text-text'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Client-side equivalent of the server ?scope filter, for lists already in memory.
export function matchesScope(item, scope) {
  if (scope === 'canonical') return !!item.is_canonical;
  if (scope === 'user') return !item.is_canonical;
  return true;
}
