import { newId } from './constellation';

export const MAX_SUITS = 12;
export const MAX_RANKS = 60;
export const MAX_CARDS = 200;

export function emptyDeck() {
  return { name: '', description: '', is_public: false, back_image_url: null, suits: [], ranks: [], cards: [] };
}

export function fromServer(item) {
  return {
    name: item.name,
    description: item.description || '',
    is_public: item.is_public,
    back_image_url: item.back_image_url || null,
    suits: item.data?.suits ?? [],
    ranks: item.data?.ranks ?? [],
    cards: item.data?.cards ?? [],
  };
}

export function toPayload(doc) {
  return {
    name: doc.name.trim(),
    description: doc.description.trim(),
    is_public: doc.is_public,
    back_image_url: doc.back_image_url || null,
    data: { suits: doc.suits, ranks: doc.ranks, cards: doc.cards },
  };
}

// «Туз, Двійка, 3» або по рядку → унікальні непорожні назви.
export function parseNames(text) {
  return [...new Set(text.split(/[,\n;]/).map((s) => s.trim()).filter(Boolean))];
}

export const newSuit = (name) => ({ id: newId(), name, image_url: null });
export const newRank = (name) => ({ id: newId(), name });
export const newCard = (extra = {}) => ({
  id: newId(), suit_id: null, rank_id: null, name: 'Нова карта', image_url: null, ...extra,
});

// Додає всі відсутні комбінації «масть × номінал» (наявні не чіпає — їхні
// назви й зображення вже могли бути відредаговані). Ряд за мастю, у порядку номіналів.
export function generateMissingCards(doc) {
  const existing = new Set(doc.cards.filter((c) => c.suit_id && c.rank_id).map((c) => `${c.suit_id}|${c.rank_id}`));
  const added = [];
  for (const suit of doc.suits) {
    for (const rank of doc.ranks) {
      if (!existing.has(`${suit.id}|${rank.id}`)) {
        added.push(newCard({ suit_id: suit.id, rank_id: rank.id, name: `${rank.name} · ${suit.name}` }));
      }
    }
  }
  const room = Math.max(0, MAX_CARDS - doc.cards.length);
  return { cards: [...doc.cards, ...added.slice(0, room)], added: Math.min(added.length, room), truncated: added.length > room };
}

// Зображення лицьової сторони: власне карти, інакше — масті.
export function faceImage(card, suitsById) {
  return card.image_url || suitsById.get(card.suit_id)?.image_url || null;
}
