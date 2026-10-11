import { useState, useEffect } from 'react';
import api from '../api/client';
import { NATURE_TYPES, setMagicForms } from '../constants/spellbook';

// Назви й описи форм магії редагуються з адмін-панелі (services/admin, ключ
// magic_forms) і читаються через spellbook-сервіс — той самий патерн, що й
// useSpellKinds. Кешуємо на рівні модуля; до першої відповіді показуємо
// початкові назви з NATURE_TYPES, щоб мітки не блимали сирими key.
const DEFAULTS = Object.entries(NATURE_TYPES).map(([key, { label }]) => ({ key, label, description: '' }));

let cache = null;
let inFlight = null;
const listeners = new Set();

function publish(list) {
  cache = list;
  setMagicForms(list);
  listeners.forEach((fn) => fn(list));
}

function fetchMagicForms() {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = api.get('/api/spellbook/magic-forms')
      .then(({ data }) => {
        // Сервер віддає лише збережений набір; ключі, яких бракує, добираємо з початкових.
        const byKey = Object.fromEntries((data.magic_forms ?? []).map((f) => [f.key, f]));
        publish(DEFAULTS.map((d) => ({ ...d, ...byKey[d.key] })));
        return cache;
      })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

// Викликається адмін-панеллю після збереження — наступні читання беруть нові значення.
export function invalidateMagicForms(saved) {
  if (Array.isArray(saved)) {
    const byKey = Object.fromEntries(saved.map((f) => [f.key, f]));
    publish(DEFAULTS.map((d) => ({ ...d, ...byKey[d.key] })));
  } else {
    cache = null;
    setMagicForms(null);
  }
}

export default function useMagicForms() {
  const [forms, setForms] = useState(cache || DEFAULTS);

  useEffect(() => {
    listeners.add(setForms);
    if (!cache) fetchMagicForms().catch(() => {});
    return () => { listeners.delete(setForms); };
  }, []);

  return {
    magicForms: forms,
    magicFormsMap: Object.fromEntries(forms.map((f) => [f.key, f])),
  };
}
