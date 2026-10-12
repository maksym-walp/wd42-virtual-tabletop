import { useState, useEffect } from 'react';
import api from '../api/client';
import { CONDITIONS, CURRENCIES } from '../constants/characterSheet';

// Стани (з описами), пари валют, раси та підвиди персонажа редагуються з адмін-панелі
// (services/admin, ключі conditions/currencies/character_races) і читаються
// через character-sheet. Кешуємо
// на рівні модуля, як useWeaponOptions. Поки відповіді немає, або коли
// конфіг порожній чи запит упав — працюємо з константами, тож лист
// персонажа ніколи не лишається без станів і валют.
let cache = null;
let inFlight = null;

function fetchConfig() {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = api.get('/api/characters/config')
      .then(({ data }) => {
        cache = {
          conditions: data.conditions?.length ? data.conditions : CONDITIONS,
          currencies: data.currencies?.length ? data.currencies : CURRENCIES,
          // Раси, відкриті адміном для персонажів: [{ id, name, description,
          // image_url, bonus_characteristic, bonus_budget, peoples: [{ id,
          // name, description, skill_bonuses }] }]. Констант-запасного варіанту
          // нема — раси живуть у компендіумі.
          races: data.races ?? [],
        };
        return cache;
      })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

// Адмінка викликає після збереження, щоб лист одразу взяв нові значення.
export function invalidateCharacterConfig() {
  cache = null;
}

const FALLBACK = { conditions: CONDITIONS, currencies: CURRENCIES, races: [] };

export default function useCharacterConfig() {
  const [config, setConfig] = useState(cache || FALLBACK);

  useEffect(() => {
    if (cache) { setConfig(cache); return; }
    let alive = true;
    fetchConfig().then((c) => { if (alive) setConfig(c); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  return config;
}
