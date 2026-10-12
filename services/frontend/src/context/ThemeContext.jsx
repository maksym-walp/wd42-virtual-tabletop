import { createContext, useContext, useEffect, useState } from 'react';
import { HEX_RE, readableOnDark } from '../utils/color';

const THEME_KEY = 'walp:theme';
// ACCENT_KEY holds the color the user picked; ACCENT_FX_KEY the contrast-adjusted
// value actually applied. The pre-paint script in index.html reads only the
// latter, so it needn't duplicate the adjustment logic.
const ACCENT_KEY = 'walp:accent';
const ACCENT_FX_KEY = 'walp:accent-fx';
export const DEFAULT_ACCENT = '#c9975a';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // The anti-flash inline script in index.html already set data-theme on
  // <html> before React mounted — read that instead of re-deriving from
  // localStorage/prefers-color-scheme here, so the two never disagree.
  const [theme, setTheme] = useState(() => (
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  ));
  // null = default parchment-gold. Only the dark theme honours a custom accent.
  const [accent, setAccent] = useState(() => {
    try {
      const stored = localStorage.getItem(ACCENT_KEY);
      return HEX_RE.test(stored) ? stored.toLowerCase() : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#1e1e1e' : '#5b440a');
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const applied = accent && readableOnDark(accent);
    if (applied) {
      root.dataset.accent = 'custom';
      root.style.setProperty('--accent-custom', applied);
    } else {
      delete root.dataset.accent;
      root.style.removeProperty('--accent-custom');
    }
    try {
      if (applied) {
        localStorage.setItem(ACCENT_KEY, accent);
        localStorage.setItem(ACCENT_FX_KEY, applied);
      } else {
        localStorage.removeItem(ACCENT_KEY);
        localStorage.removeItem(ACCENT_FX_KEY);
      }
    } catch { /* ignore */ }
  }, [accent]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
