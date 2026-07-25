import { NavLink } from 'react-router-dom';

// Sub-navigation for the Maps section: maps list vs. the location library.
const TABS = [
  { to: '/maps', label: 'Мапи', end: true },
  { to: '/maps/locations', label: 'Локації' },
];

export default function MapsTabs() {
  return (
    <div className="mb-6 flex gap-2 border-b border-border">
      {TABS.map((t) => (
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
  );
}
