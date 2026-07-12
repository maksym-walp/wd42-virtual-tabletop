import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NAV_ITEMS } from '../constants/navigation';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-40 hidden border-b border-border bg-surface md:block">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <NavLink to="/" className="font-display text-lg font-semibold text-accent">
          ⚔ Walp Tabletop
        </NavLink>

        {user ? (
          <div className="flex items-center gap-6">
            {NAV_ITEMS.filter((i) => i.to !== '/profile').map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => (isActive ? 'text-accent' : 'text-text-muted hover:text-text')}
              >
                {label}
              </NavLink>
            ))}
            <NavLink
              to="/profile"
              className={({ isActive }) => `text-sm ${isActive ? 'text-accent' : 'text-text-dim hover:text-text'}`}
            >
              @{user.username}
            </NavLink>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted hover:bg-surface-hover"
            >
              <LogOut size={16} /> Вийти
            </button>
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
