import { NavLink } from 'react-router-dom';

// Standard sub-navigation bar for any catalog service (equipment, spellbook,
// compendium, ...): a horizontal row of NavLinks that stays mounted whether
// you're browsing the catalog itself or its Колекції — so a collection page
// never reads as "a different page", just another tab of the same service.
// flex-1 lets tabs grow to fill the row whenever there's room (any viewport,
// not just desktop) — but flex items never shrink below their own content
// size by default, so once there isn't enough room the row simply overflows
// into the horizontal scroll below (no visible scrollbar, same trick as the
// location image slider) instead of wrapping or squeezing labels.
//
// `sidebar` — вкладки стоять у бічній панелі каталогу (CatalogLayout): від
// lg вони переносяться пілюлями (5 вкладок спорядження не влазять у 20rem),
// нижче lg поводяться як звичайний рядок.
export default function CatalogTabs({ tabs, sidebar = false }) {
  return (
    <div className={`flex gap-1 overflow-x-auto border-b border-border no-scrollbar sm:gap-2 ${
      sidebar ? 'mb-2 lg:mb-0 lg:flex-wrap lg:gap-1.5 lg:overflow-visible lg:border-b-0' : 'mb-6'
    }`}>
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `flex-1 whitespace-nowrap rounded-t-lg border border-b-0 px-2 py-2 text-center text-sm font-semibold transition-colors sm:px-4 ${
              sidebar ? 'lg:flex-none lg:rounded-lg lg:border-b lg:px-3 lg:py-1.5' : ''
            } ${
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
