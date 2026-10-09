import { ENTITY_KINDS } from './entityRegistry';

// Кеш на рівні модуля: той самий запис, на який посилається десяток чіпів,
// вантажиться один раз (проміс дедуплікує запити, що ще в дорозі). Через
// хвилину запис підтягується знову, щоб правки не застрягали надовго.
const TTL = 60_000;
const ERROR_TTL = 10_000;
const store = new Map();

export function cached(key, loader, ttl = TTL) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.ts < hit.ttl) return hit.promise;
  const entry = { promise: loader(), ts: Date.now(), ttl };
  store.set(key, entry);
  entry.promise.catch(() => { entry.ttl = ERROR_TTL; });
  return entry.promise;
}

export const fetchEntity = (kind, id) => cached(`${kind}:${id}`, () => ENTITY_KINDS[kind].fetch(id));
