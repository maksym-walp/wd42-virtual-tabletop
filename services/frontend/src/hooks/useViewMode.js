import { useState, useEffect } from 'react';

// Cards is always the default for a first-time visitor; a saved 'table'
// choice only sticks per catalog (keyed by `key`) once the user opts in.
export default function useViewMode(key) {
  const storageKey = `walp:viewMode:${key}`;
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === 'table' ? 'table' : 'cards';
    } catch {
      return 'cards';
    }
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, mode); } catch { /* ignore */ }
  }, [mode, storageKey]);

  return [mode, setMode];
}
