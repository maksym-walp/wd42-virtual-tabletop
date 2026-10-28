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

  it('requires names for suits and ranks', () => {
    const noSuitName = base();
    noSuitName.suits[0].name = '  ';
    expect(() => sanitizeDeckData(noSuitName)).toThrow(/обов'язкове/);

    const noRankName = base();
    noRankName.ranks[0].name = '';
    expect(() => sanitizeDeckData(noRankName)).toThrow(/обов'язкове/);
  });

  it('lets a card with both suit and rank omit its name and description', () => {
    const data = base();
    data.cards[0].name = '';
    delete data.cards[0].description;
    const [card] = sanitizeDeckData(data).cards;
    expect(card.name).toBe('');
    expect(card.description).toBe('');
  });

  it.each([
    ['no suit', { suit_id: null, rank_id: 'r1' }],
    ['no rank', { suit_id: 's1', rank_id: null }],
    ['neither', { suit_id: null, rank_id: null }],
  ])('still requires a name when the card has %s', (_label, link) => {
    const data = base();
    data.cards[0] = { id: 'c1', name: '  ', ...link };
    expect(() => sanitizeDeckData(data)).toThrow(/обов'язкове/);
  });

  it('keeps a trimmed card description and rejects an over-long one', () => {
    const data = base();
    data.cards[0].description = '  Символ початку  ';
    expect(sanitizeDeckData(data).cards[0].description).toBe('Символ початку');

    data.cards[0].description = 'x'.repeat(2001);
    expect(() => sanitizeDeckData(data)).toThrow(/опис/);
  });

  it('keeps optional card effect and interpretation, defaulting to empty', () => {
    const data = base();
    data.cards[0].effect = '  Добери карту  ';
    data.cards[0].interpretation = ' Новий початок ';
    const [card] = sanitizeDeckData(data).cards;
    expect(card.effect).toBe('Добери карту');
    expect(card.interpretation).toBe('Новий початок');

    delete data.cards[0].effect;
    delete data.cards[0].interpretation;
    const [bare] = sanitizeDeckData(data).cards;
    expect(bare.effect).toBe('');
    expect(bare.interpretation).toBe('');
  });

  it('rejects an over-long card effect or interpretation', () => {
    const data = base();
    data.cards[0].effect = 'x'.repeat(2001);
    expect(() => sanitizeDeckData(data)).toThrow(/ефект/);

    data.cards[0].effect = '';
    data.cards[0].interpretation = 'x'.repeat(2001);
    expect(() => sanitizeDeckData(data)).toThrow(/трактування/);
  });

  it('rejects more than the maximum number of cards', () => {
    const data = base();
    data.cards = Array.from({ length: MAX_CARDS + 1 }, (_, i) => ({ id: `c${i}`, name: `Карта ${i}` }));
    expect(() => sanitizeDeckData(data)).toThrow(/максимум/);
  });
});
