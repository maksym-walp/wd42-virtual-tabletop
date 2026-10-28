const {
  ValidationError, cleanText, requireText, cleanId, cleanImageUrl, requireArray, requireObject,
} = require('./validation');

const MAX_SUITS = 12;
const MAX_RANKS = 60;
const MAX_CARDS = 200;

function uniqueIds(items, field) {
  const ids = new Set();
  items.forEach((item) => {
    if (ids.has(item.id)) throw new ValidationError(`${field}: id "${item.id}" повторюється`);
    ids.add(item.id);
  });
  return ids;
}

// Документ колоди:
//   suits: [{ id, name, image_url }]            — масті (необов'язкові)
//   ranks: [{ id, name }]                       — номінали
//   cards: [{ id, suit_id|null, rank_id|null, name, description, effect, interpretation, image_url }]
// Карти без масті (наприклад, старші аркани таро) — suit_id: null. Карти
// зберігаються явно (а не як масть × номінал), щоб кожній можна було дати
// власні назву, опис, ефект, трактування і зображення. Ефект і трактування
// необов'язкові (порожній рядок), у старих колодах їх просто нема.
// Назва й опис необов'язкові, коли в карти є і масть, і номінал (назву тоді
// складає клієнт: «Туз · Кубки»); якщо масті чи номіналу немає — назва обов'язкова.
function sanitizeDeckData(raw) {
  const data = requireObject(raw ?? {}, 'data');

  const suits = requireArray(data.suits, MAX_SUITS, 'suits').map((suit, i) => {
    const field = `Масть №${i + 1}`;
    requireObject(suit, field);
    return {
      id: cleanId(suit.id, field),
      name: requireText(suit.name, 100, `${field}, назва`),
      image_url: cleanImageUrl(suit.image_url, `${field}, зображення`),
    };
  });
  const suitIds = uniqueIds(suits, 'Масті');

  const ranks = requireArray(data.ranks, MAX_RANKS, 'ranks').map((rank, i) => {
    const field = `Номінал №${i + 1}`;
    requireObject(rank, field);
    return { id: cleanId(rank.id, field), name: requireText(rank.name, 100, `${field}, назва`) };
  });
  const rankIds = uniqueIds(ranks, 'Номінали');

  const cards = requireArray(data.cards, MAX_CARDS, 'cards').map((card, i) => {
    const field = `Карта №${i + 1}`;
    requireObject(card, field);
    const suitId = card.suit_id ?? null;
    const rankId = card.rank_id ?? null;
    if (suitId !== null && !suitIds.has(suitId)) throw new ValidationError(`${field}: невідома масть`);
    if (rankId !== null && !rankIds.has(rankId)) throw new ValidationError(`${field}: невідомий номінал`);
    const nameField = `${field}, назва`;
    const name = suitId !== null && rankId !== null
      ? cleanText(card.name, 150, nameField)
      : requireText(card.name, 150, nameField);
    return {
      id: cleanId(card.id, field),
      suit_id: suitId,
      rank_id: rankId,
      name,
      description: cleanText(card.description, 2000, `${field}, опис`),
      effect: cleanText(card.effect, 2000, `${field}, ефект`),
      interpretation: cleanText(card.interpretation, 2000, `${field}, трактування`),
      image_url: cleanImageUrl(card.image_url, `${field}, зображення`),
    };
  });
  uniqueIds(cards, 'Карти');

  return { suits, ranks, cards };
}

module.exports = { sanitizeDeckData, MAX_SUITS, MAX_RANKS, MAX_CARDS };
