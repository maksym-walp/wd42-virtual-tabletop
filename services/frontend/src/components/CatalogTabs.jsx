import { NavLink } from 'react-router-dom';

// Standard sub-navigation bar for any catalog service (equipment, spellbook,
// compendium, ...): a horizontal row of NavLinks that stays mounted whether
// you're browsing the catalog itself or its Колекції — so a collection page
// never reads as "a different page", just another tab of the same service.
// Scrolls horizontally (no visible scrollbar, same trick as the location
// image slider) instead of wrapping or overflowing the viewport on phones,
// where four tabs rarely fit — shrink-0 keeps each tab at its natural width
// so the row scrolls instead of squeezing labels.
export default function CatalogTabs({ tabs }) {
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto border-b border-border no-scrollbar">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `shrink-0 whitespace-nowrap rounded-t-lg border border-b-0 px-4 py-2 text-sm font-semibold transition-colors ${
              isActive ? 'border-gold/60 bg-gold/10 text-gold' : 'border-transparent text-text-dim'
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
