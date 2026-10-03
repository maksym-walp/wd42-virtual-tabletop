import { useState, useEffect } from 'react';
import api from '../api/client';
import { SPELL_KINDS } from '../constants/spellbook';

// Види заклинань редагуються з адмін-панелі (services/admin, ключ
// spell_kinds) і читаються звідти через spellbook-сервіс — той самий
// патерн, що й useWeaponOptions. Кешуємо на рівні модуля. До першої
// відповіді показуємо початковий набір із constants/spellbook.js, щоб
// мітки не блимали сирими key.
let cache = null;
let inFlight = null;

function fetchKinds() {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = api.get('/api/spellbook/kinds')
      .then(({ data }) => { cache = data.spell_kinds; return cache; })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

const DEFAULTS = Object.entries(SPELL_KINDS).map(([key, { label }]) => ({ key, label }));

export default function useSpellKinds() {
  const [kinds, setKinds] = useState(cache || DEFAULTS);

  useEffect(() => {
    if (cache) return;
    fetchKinds().then(setKinds).catch(() => {});
  }, []);

  return {
    spellKinds: kinds,
    spellKindsMap: Object.fromEntries(kinds.map((k) => [k.key, k])),
  };
}
