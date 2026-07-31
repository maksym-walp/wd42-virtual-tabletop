import { NavLink } from 'react-router-dom';

// Standard sub-navigation bar for any catalog service (equipment, spellbook,
// compendium, ...): a horizontal row of NavLinks that stays mounted whether
// you're browsing the catalog itself or its Колекції — so a collection page
// never reads as "a different page", just another tab of the same service.
// `right` is an optional trailing slot (e.g. the cards/list ViewToggle),
// pinned to the far end of the same row instead of its own line below.
export default function CatalogTabs({ tabs, right }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3 border-b border-border">
      <div className="flex gap-2">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `rounded-t-lg border border-b-0 px-4 py-2 text-sm font-semibold transition-colors ${
                isActive ? 'border-gold/60 bg-gold/10 text-gold' : 'border-transparent text-text-dim'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      {right && <div className="pb-2">{right}</div>}
    </div>
  );
}
