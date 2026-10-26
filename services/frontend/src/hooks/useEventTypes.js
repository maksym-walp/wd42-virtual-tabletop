import { useState, useEffect } from 'react';
import chronologyApi from '../api/chronology';

// Типи подій хронології ({ key, label, color }) задає адмін у панелі
// (services/admin, ключ event_types); читаються через chronology-сервіс — той
// самий патерн, що й useMagicForms. Кешуємо на рівні модуля, а адмін-панель
// після збереження оновлює кеш через invalidateEventTypes.
let cache = null;
let inFlight = null;
const listeners = new Set();

function publish(list) {
  cache = list;
  listeners.forEach((fn) => fn(list));
}

function fetchEventTypes() {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = chronologyApi.listEventTypes()
      .then((list) => { publish(list); return list; })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

export function invalidateEventTypes(saved) {
  if (Array.isArray(saved)) publish(saved);
  else cache = null;
}

export default function useEventTypes() {
  const [types, setTypes] = useState(cache || []);

  useEffect(() => {
    listeners.add(setTypes);
    if (cache) setTypes(cache);
    else fetchEventTypes().catch(() => {});
    return () => { listeners.delete(setTypes); };
  }, []);

  return {
    eventTypes: types,
    eventTypesMap: Object.fromEntries(types.map((t) => [t.key, t])),
  };
}
