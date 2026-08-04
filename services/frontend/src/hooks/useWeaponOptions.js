import { useState, useEffect } from 'react';
import api from '../api/client';

// Допустимі типи зброї та особливості (weapon_grip) редагуються з
// адмін-панелі (services/admin) і читаються звідти через equipment-сервіс —
// замінюють колишні захардкоджені WEAPON_TYPES/WEAPON_GRIPS у
// constants/equipment.js. Кешуємо на рівні модуля: у межах однієї сесії
// список практично не міняється, тож повторний фетч на кожній сторінці
// каталогу зброї не потрібен.
let cache = null;
let inFlight = null;

function fetchOptions() {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = api.get('/api/equipment/weapons/options')
      .then(({ data }) => { cache = data; return data; })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

const EMPTY = { weapon_types: [], weapon_grips: [] };

export default function useWeaponOptions() {
  const [options, setOptions] = useState(cache || EMPTY);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    fetchOptions().then(setOptions).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toMap = (list) => Object.fromEntries(list.map((o) => [o.key, o]));

  return {
    weaponTypes: options.weapon_types,
    weaponGrips: options.weapon_grips,
    weaponTypesMap: toMap(options.weapon_types),
    weaponGripsMap: toMap(options.weapon_grips),
    loading,
  };
}
