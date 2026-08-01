import { Link } from 'react-router-dom';

// Shared "Тип" row across every catalog domain's creation forms (equipment's
// weapon/armor/item/artifact/collection, abilities' ability/maneuver/
// collection, spellbook's spell/tradition/collection, compendium's npc/
// creature/species/collection) — one click reaches any sibling kind, even
// though each domain's kinds live on their own page with their own field set.
// `kinds` comes from the calling domain (COLLECTION_DOMAINS[key].kindSwitch);
// this component has no domain knowledge of its own.
//
// A kind switches in place (same form, e.g. weapon → armor moves table but
// stays on this page) only if it's in `localKeys`; everything else always
// navigates to its own fresh "new" page since its fields/table are unrelated.
// `localDisabled` greys out the local-switch kinds without touching the
// navigable ones — used where switching kind in place isn't allowed once a
// record already exists (e.g. compendium entries can't change npc↔creature
// after creation).
export default function KindSwitch({ kinds, active, localKeys = [], onSelectLocal, localDisabled = false }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {kinds.map(({ key, label, newPath }) => {
        const isActive = key === active;
        const isLocal = localKeys.includes(key);
        const className = `rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
          isActive ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border text-text-dim'
        } ${isLocal && localDisabled && !isActive ? 'cursor-not-allowed opacity-50' : ''}`;

        if (isActive) return <span key={key} className={className}>{label}</span>;
        if (isLocal) {
          if (localDisabled) return <span key={key} className={className}>{label}</span>;
          return (
            <button key={key} type="button" onClick={() => onSelectLocal(key)} className={className}>
              {label}
            </button>
          );
        }
        return <Link key={key} to={newPath} className={className}>{label}</Link>;
      })}
    </div>
  );
}
