const { sanitizeDeckData, MAX_CARDS } = require('../deck-data');

const base = () => ({
  suits: [{ id: 's1', name: 'Кубки', image_url: '/uploads/tools/decks/a.png' }],
  ranks: [{ id: 'r1', name: 'Туз' }, { id: 'r2', name: 'Двійка' }],
  cards: [
    { id: 'c1', suit_id: 's1', rank_id: 'r1', name: 'Туз Кубків', image_url: null },
    { id: 'c2', suit_id: null, rank_id: null, name: 'Шут', image_url: 'https://example.com/fool.png' },
  ],
});

describe('sanitizeDeckData', () => {
  it('accepts a deck with suit cards and suitless cards (major arcana)', () => {
    const data = sanitizeDeckData(base());
    expect(data.cards).toHaveLength(2);
    expect(data.cards[1]).toMatchObject({ suit_id: null, rank_id: null });
  });

  it('treats a missing body as an empty deck', () => {
    expect(sanitizeDeckData(undefined)).toEqual({ suits: [], ranks: [], cards: [] });
  });

  it('normalizes an empty image url to null', () => {
    const data = base();
    data.suits[0].image_url = '';
    expect(sanitizeDeckData(data).suits[0].image_url).toBeNull();
  });

  it.each(['javascript:alert(1)', 'data:image/png;base64,AAAA', 'http://insecure.example/x.png', '//evil/x.png'])(
    'rejects image url %p', (url) => {
      const data = base();
      data.cards[0].image_url = url;
      expect(() => sanitizeDeckData(data)).toThrow(/зображення/);
    },
  );

  it('rejects cards pointing at an unknown suit or rank', () => {
    const badSuit = base();
    badSuit.cards[0].suit_id = 'nope';
    expect(() => sanitizeDeckData(badSuit)).toThrow(/масть/);

    const badRank = base();
    badRank.cards[0].rank_id = 'nope';
    expect(() => sanitizeDeckData(badRank)).toThrow(/номінал/);
  });

  it('rejects duplicate ids within suits, ranks and cards', () => {
    const suits = base();
    suits.suits.push({ id: 's1', name: 'Мечі' });
    expect(() => sanitizeDeckData(suits)).toThrow(/Масті/);

    const ranks = base();
    ranks.ranks.push({ id: 'r1', name: 'Трійка' });
    expect(() => sanitizeDeckData(ranks)).toThrow(/Номінали/);

    const cards = base();
    cards.cards[1].id = 'c1';
    expect(() => sanitizeDeckData(cards)).toThrow(/Карти/);
  });

  it('requires names for suits, ranks and cards', () => {
    const noSuitName = base();
    noSuitName.suits[0].name = '  ';
    expect(() => sanitizeDeckData(noSuitName)).toThrow(/обов'язкове/);

    const noCardName = base();
    noCardName.cards[0].name = '';
    expect(() => sanitizeDeckData(noCardName)).toThrow(/обов'язкове/);
  });

  it('rejects more than the maximum number of cards', () => {
    const data = base();
    data.cards = Array.from({ length: MAX_CARDS + 1 }, (_, i) => ({ id: `c${i}`, name: `Карта ${i}` }));
    expect(() => sanitizeDeckData(data)).toThrow(/максимум/);
  });
});
