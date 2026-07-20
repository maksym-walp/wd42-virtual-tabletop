import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MoreHorizontal, Dices, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDice } from '../context/DiceContext';
import { MOBILE_PRIMARY_NAV_ITEMS, MOBILE_MORE_NAV_ITEMS } from '../constants/navigation';

// flex-1 (not a fixed width) so exactly 5 tabs always fill the bar with no
// horizontal scrolling, regardless of screen width.
const TAB_CLASS = 'flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.7rem] font-semibold';

export default function BottomNav() {
  const { user } = useAuth();
  const location = useLocation();
  const { isOpen: diceOpen, toggle: toggleDice } = useDice();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the overflow menu whenever navigation happens (including via one
  // of its own links) so it doesn't stay open on the newly loaded page.
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  if (!user) return null;

  const moreActive = MOBILE_MORE_NAV_ITEMS.some((item) => location.pathname.startsWith(item.to));

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMoreOpen(false)} />
      )}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Основна навігація"
      >
        {moreOpen && (
          <div className="absolute inset-x-3 bottom-full mb-2 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-surface shadow-xl">
            {MOBILE_MORE_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 border-b border-border px-4 py-3 text-sm font-semibold last:border-b-0 ${
                    isActive ? 'text-accent' : 'text-text'
                  }`
                }
              >
                <Icon size={20} strokeWidth={1.75} />
                {label}
              </NavLink>
            ))}
          </div>
        )}

        <div className="flex">
          {MOBILE_PRIMARY_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `${TAB_CLASS} ${isActive ? 'text-accent' : 'text-text-dim'}`}
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.25 : 1.75} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}

          <NavLink to="/" end className={({ isActive }) => `${TAB_CLASS} ${isActive ? 'text-accent' : 'text-text-dim'}`}>
            {({ isActive }) => (
              <>
                <Home size={22} strokeWidth={isActive ? 2.25 : 1.75} />
                <span>Головна</span>
              </>
            )}
          </NavLink>

          <button
            type="button"
            onClick={toggleDice}
            className={`${TAB_CLASS} ${diceOpen ? 'text-accent' : 'text-text-dim'}`}
          >
            <Dices size={22} strokeWidth={diceOpen ? 2.25 : 1.75} />
            <span>Кубики</span>
          </button>

          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            className={`${TAB_CLASS} ${moreOpen || moreActive ? 'text-accent' : 'text-text-dim'}`}
          >
            <MoreHorizontal size={22} strokeWidth={moreOpen || moreActive ? 2.25 : 1.75} />
            <span>Ще</span>
          </button>
        </div>
      </nav>
    </>
  );
}
