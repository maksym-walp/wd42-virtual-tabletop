import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, ChevronDown, Settings, Palette, CircleUserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NAV_MAIN_ITEMS, NAV_MORE_ITEMS } from '../constants/navigation';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Close both dropdowns whenever navigation happens so they don't stay open
  // on the newly loaded page.
  useEffect(() => { setMoreOpen(false); setSettingsOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const moreActive = NAV_MORE_ITEMS.some((item) => location.pathname.startsWith(item.to));

  return (
    <nav className="sticky top-0 z-40 hidden border-b border-border bg-surface md:block">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <NavLink to="/" className="font-display text-lg font-semibold text-accent">
          ⚔ Walp Tabletop
        </NavLink>

        {user ? (
          <div className="flex items-center gap-6">
            {NAV_MAIN_ITEMS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => (isActive ? 'text-accent' : 'text-text-muted hover:text-text')}
              >
                {label}
              </NavLink>
            ))}

            <div className="relative">
              <button
                type="button"
                onClick={() => { setMoreOpen((o) => !o); setSettingsOpen(false); }}
                aria-expanded={moreOpen}
                className={`inline-flex items-center gap-1 text-sm font-semibold ${moreOpen || moreActive ? 'text-accent' : 'text-text-muted hover:text-text'}`}
              >
                Ще
                <ChevronDown size={15} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>

              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
                  <div className="absolute right-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
                    {NAV_MORE_ITEMS.map(({ to, label, icon: Icon }) => (
                      <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 border-b border-border px-4 py-2.5 text-sm font-semibold last:border-b-0 ${
                            isActive ? 'text-accent' : 'text-text'
                          }`
                        }
                      >
                        <Icon size={16} strokeWidth={1.75} />
                        {label}
                      </NavLink>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => { setSettingsOpen((o) => !o); setMoreOpen(false); }}
                aria-expanded={settingsOpen}
                aria-label="Налаштування"
                className={`inline-flex items-center rounded-lg border border-border p-2 ${settingsOpen ? 'text-accent' : 'text-text-muted hover:text-text'}`}
              >
                <Settings size={18} strokeWidth={1.75} />
              </button>

              {settingsOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setSettingsOpen(false)} />
                  <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
                    <NavLink
                      to="/profile"
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 border-b border-border px-4 py-2.5 text-sm font-semibold ${isActive ? 'text-accent' : 'text-text'}`
                      }
                    >
                      <CircleUserRound size={16} strokeWidth={1.75} />
                      Особистий профіль
                    </NavLink>
                    <button
                      type="button"
                      disabled
                      title="У розробці"
                      className="flex w-full cursor-not-allowed items-center gap-2.5 border-b border-border px-4 py-2.5 text-left text-sm font-semibold text-text-dim opacity-50"
                    >
                      <Palette size={16} strokeWidth={1.75} />
                      Змінити тему
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-danger"
                    >
                      <LogOut size={16} strokeWidth={1.75} />
                      Вийти
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <NavLink to="/login" className="text-text-muted hover:text-text">Увійти</NavLink>
            <NavLink to="/register" className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-bg">
              Реєстрація
            </NavLink>
          </div>
        )}
      </div>
    </nav>
  );
}
