import { useState, useEffect } from 'react';
import api from '../api/client';

// Рівні (кубик зцілення), розміри (порції) й ефекти зілля — їх віддає
// equipment-сервіс (GET /api/equipment/potions/options); відповідність
// рівень → кубик і розмір → порції задає БД (міграція 110). Кешуємо на рівні
// модуля, як useWeaponOptions.
let cache = null;
let inFlight = null;

function fetchOptions() {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = api.get('/api/equipment/potions/options')
      .then(({ data }) => { cache = data; return data; })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

const EMPTY = { tiers: [], sizes: [], effects: [] };
const toMap = (list) => Object.fromEntries(list.map((o) => [o.key, o]));

export default function usePotionOptions() {
  const [options, setOptions] = useState(cache || EMPTY);

  useEffect(() => {
    if (cache) return;
    fetchOptions().then(setOptions).catch(() => {});
  }, []);

  return {
    tiers: options.tiers,
    sizes: options.sizes,
    effects: options.effects,
    tiersMap: toMap(options.tiers),
    sizesMap: toMap(options.sizes),
    effectsMap: toMap(options.effects),
  };
}

// «Відвар · d6 · флакон (6 порцій)» — підпис зілля з даних запису.
export function potionSummary(item, { tiersMap = {}, sizesMap = {} } = {}) {
  if (!item) return '';
  const tier = tiersMap[item.potion_tier]?.label ?? item.potion_tier;
  const size = sizesMap[item.potion_size]?.label ?? item.potion_size;
  const die = item.heal_die ? `d${item.heal_die}` : null;
  const portions = item.portions ? `${item.portions} ${portionsWord(item.portions)}` : null;
  return [tier, die, size && portions ? `${size.toLowerCase()} (${portions})` : size].filter(Boolean).join(' · ');
}

export function portionsWord(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'порція';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'порції';
  return 'порцій';
}
