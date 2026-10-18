// Механіка столу з колодою — чисті функції без React. Стіл — це стопки:
//   { piles: [{ id, name, cards: [{ cardId, faceUp }] }] }
// cards[0] — верхня карта стопки. Кожна операція повертає НОВИЙ стан (старий
// не змінюється), а випадковість іде через randomInt (crypto, не Math.random:
// перетасовка колоди має бути чесною, а не «майже випадковою»).
//
// Лицьова сторона після ходу:
//   * перетасовка й розкладка по стопках кладуть усе сорочкою догори;
//   * карта, вставлена в середину/низ/випадкове місце, лягає сорочкою догори —
//     як у житті: подивилась, засунула назад і не показуєш;
//   * карта, покладена зверху, зберігає лицьову сторону.

export const POSITIONS = {
  top: 'Зверху',
  middle: 'У середину',
  bottom: 'Знизу',
  random: 'У випадкове місце',
};

let counter = 0;
export function newPileId() {
  counter += 1;
  return `pile-${Date.now().toString(36)}-${counter}`;
}

// Рівномірне ціле з [0, max) без «зсуву за модулем» (rejection sampling).
export function randomInt(max) {
  if (max <= 1) return 0;
  const c = globalThis.crypto;
  if (!c?.getRandomValues) return Math.floor(Math.random() * max);
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do { c.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % max;
}

// Fisher–Yates на копії.
export function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const faceDown = (cards) => cards.map((c) => ({ ...c, faceUp: false }));
const mapPile = (state, pileId, fn) => ({
  ...state,
  piles: state.piles.map((p) => (p.id === pileId ? fn(p) : p)),
});
const findPile = (state, pileId) => state.piles.find((p) => p.id === pileId);

// Новий стіл: одна стопка з усією колодою в порядку редактора, сорочкою догори.
export function createTable(deck, { shuffle = false } = {}) {
  const cards = deck.data.cards.map((c) => ({ cardId: c.id, faceUp: false }));
  return { piles: [{ id: newPileId(), name: 'Колода', cards: shuffle ? shuffled(cards) : cards }] };
}

// Чи збережений стіл відповідає колоді: ті самі карти, кожна рівно один раз.
// Якщо колоду відредагували після гри, збережений стіл безглуздий — скидаємо.
export function isTableValidFor(table, deck) {
  if (!table || !Array.isArray(table.piles) || table.piles.length === 0) return false;
  const expected = new Set(deck.data.cards.map((c) => c.id));
  const seen = new Set();
  for (const pile of table.piles) {
    if (typeof pile?.id !== 'string' || !Array.isArray(pile.cards)) return false;
    for (const card of pile.cards) {
      if (!expected.has(card?.cardId) || seen.has(card.cardId)) return false;
      seen.add(card.cardId);
    }
  }
  return seen.size === expected.size;
}

export function shufflePile(state, pileId) {
  return mapPile(state, pileId, (p) => ({ ...p, cards: faceDown(shuffled(p.cards)) }));
}

// Перевернути верхню карту. Повертає той самий стан, якщо стопка порожня.
export function flipTop(state, pileId) {
  return mapPile(state, pileId, (p) => (p.cards.length === 0 ? p : {
    ...p,
    cards: p.cards.map((c, i) => (i === 0 ? { ...c, faceUp: !c.faceUp } : c)),
  }));
}

// Індекс вставки в стопку довжиною `length` (вже без переміщуваної карти).
export function insertIndex(position, length) {
  switch (position) {
    case 'top': return 0;
    case 'bottom': return length;
    case 'middle': return Math.ceil(length / 2);
    case 'random': return randomInt(length + 1);
    default: throw new Error(`Невідома позиція: ${position}`);
  }
}

// Перенести карту з індексом `index` зі стопки `fromId` у стопку `toId`
// (можливо ту саму — наприклад, «верхню в середину колоди»).
export function moveCard(state, fromId, index, toId, position) {
  const from = findPile(state, fromId);
  const to = findPile(state, toId);
  if (!from || !to || index < 0 || index >= from.cards.length) return state;

  const card = from.cards[index];
  const without = from.cards.filter((_, i) => i !== index);
  const target = fromId === toId ? without : to.cards;
  const at = insertIndex(position, target.length);
  const moved = position === 'top' ? card : { ...card, faceUp: false };
  const next = [...target.slice(0, at), moved, ...target.slice(at)];

  return {
    ...state,
    piles: state.piles.map((p) => {
      if (p.id === toId) return { ...p, cards: next };
      if (p.id === fromId) return { ...p, cards: without };
      return p;
    }),
  };
}

// Нові стопки ідуть одразу після початкової; імена нумеруються.
function insertPilesAfter(state, pileId, newPiles) {
  const idx = state.piles.findIndex((p) => p.id === pileId);
  const piles = [...state.piles];
  piles.splice(idx + 1, 0, ...newPiles);
  return { ...state, piles };
}

// Розділити стопку на `parts` стопок (2–12).
//   'chunks' — по порядку, шматками: як розрізати колоду на частини;
//   'deal'   — по одній карті по колу: як роздати.
// Початкова стопка лишається першою частиною, решта — нові стопки.
export function splitPile(state, pileId, parts, method = 'chunks') {
  const pile = findPile(state, pileId);
  const n = Math.floor(parts);
  if (!pile || !(n >= 2) || n > 12 || pile.cards.length < 2) return state;

  const groups = Array.from({ length: n }, () => []);
  if (method === 'deal') {
    pile.cards.forEach((card, i) => groups[i % n].push(card));
  } else {
    // Розкидаємо залишок на перші групи, щоб розміри різнилися щонайбільше на 1.
    const base = Math.floor(pile.cards.length / n);
    const extra = pile.cards.length % n;
    let start = 0;
    groups.forEach((group, i) => {
      const size = base + (i < extra ? 1 : 0);
      group.push(...pile.cards.slice(start, start + size));
      start += size;
    });
  }

  const extraPiles = groups.slice(1).map((cards, i) => ({
    id: newPileId(), name: `${pile.name} ${i + 2}`, cards,
  }));
  const updated = mapPile(state, pileId, (p) => ({ ...p, cards: groups[0] }));
  return insertPilesAfter(updated, pileId, extraPiles);
}

// Зняти зверху `count` карт у нову стопку (звичайне «зняти колоду»).
export function cutPile(state, pileId, count) {
  const pile = findPile(state, pileId);
  const n = Math.floor(count);
  if (!pile || !(n >= 1) || n >= pile.cards.length) return state;

  const top = pile.cards.slice(0, n);
  const updated = mapPile(state, pileId, (p) => ({ ...p, cards: p.cards.slice(n) }));
  return insertPilesAfter(updated, pileId, [{ id: newPileId(), name: `${pile.name} (знято)`, cards: top }]);
}

// Скласти стопку `fromId` зверху на `toId` і прибрати порожню.
export function mergePile(state, fromId, toId) {
  const from = findPile(state, fromId);
  const to = findPile(state, toId);
  if (!from || !to || fromId === toId) return state;
  return {
    ...state,
    piles: state.piles
      .map((p) => (p.id === toId ? { ...p, cards: [...from.cards, ...p.cards] } : p))
      .filter((p) => p.id !== fromId),
  };
}

export function addPile(state, name) {
  return { ...state, piles: [...state.piles, { id: newPileId(), name: name || `Стопка ${state.piles.length + 1}`, cards: [] }] };
}

export function renamePile(state, pileId, name) {
  return mapPile(state, pileId, (p) => ({ ...p, name }));
}

// Видалити можна лише порожню стопку (карти не губляться) і не останню.
export function removePile(state, pileId) {
  const pile = findPile(state, pileId);
  if (!pile || pile.cards.length > 0 || state.piles.length <= 1) return state;
  return { ...state, piles: state.piles.filter((p) => p.id !== pileId) };
}
