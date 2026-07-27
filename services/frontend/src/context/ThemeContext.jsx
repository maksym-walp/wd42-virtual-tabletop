import { createContext, useContext, useEffect, useState } from 'react';

const THEME_KEY = 'walp:theme';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // The anti-flash inline script in index.html already set data-theme on
  // <html> before React mounted — read that instead of re-deriving from
  // localStorage/prefers-color-scheme here, so the two never disagree.
  const [theme, setTheme] = useState(() => (
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  ));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#1e1e1e' : '#5b440a');
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
