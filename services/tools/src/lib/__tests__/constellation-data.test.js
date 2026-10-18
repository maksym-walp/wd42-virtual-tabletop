const { sanitizeConstellationData, MAX_STARS } = require('../constellation-data');

const star = (id, extra = {}) => ({ id, x: 10, y: 20, size: 2, name: 'Альфа', description: 'Яскрава', ...extra });

describe('sanitizeConstellationData', () => {
  it('keeps a valid document and rounds coordinates to 2 decimals', () => {
    const data = sanitizeConstellationData({
      stars: [star('a', { x: 1.23456, y: -7.891 }), star('b')],
      lines: [{ a: 'a', b: 'b' }],
    });
    expect(data.stars[0]).toMatchObject({ id: 'a', x: 1.23, y: -7.89, size: 2 });
    expect(data.lines).toEqual([{ a: 'a', b: 'b' }]);
  });

  it('treats a missing body as an empty constellation', () => {
    expect(sanitizeConstellationData(undefined)).toEqual({ stars: [], lines: [] });
    expect(sanitizeConstellationData({})).toEqual({ stars: [], lines: [] });
  });

  it('drops fields that are not in the schema', () => {
    const [clean] = sanitizeConstellationData({ stars: [star('a', { evil: '<script>' })] }).stars;
    expect(clean).not.toHaveProperty('evil');
  });

  it.each([0, 4, 1.5, '', null, 'big'])('rejects star size %p', (size) => {
    expect(() => sanitizeConstellationData({ stars: [star('a', { size })] })).toThrow(/рівень/);
  });

  it.each([
    ['non-finite x', { x: 'abc' }],
    ['null y', { y: null }],
    ['huge coordinate', { x: 1e9 }],
  ])('rejects %s', (_label, extra) => {
    expect(() => sanitizeConstellationData({ stars: [star('a', extra)] })).toThrow();
  });

  it('rejects duplicate star ids', () => {
    expect(() => sanitizeConstellationData({ stars: [star('a'), star('a')] })).toThrow(/повторюється/);
  });

  it('rejects a star without an id', () => {
    expect(() => sanitizeConstellationData({ stars: [star('')] })).toThrow(/id/);
  });

  it('rejects an over-long star name and description', () => {
    expect(() => sanitizeConstellationData({ stars: [star('a', { name: 'x'.repeat(101) })] })).toThrow(/назва/);
    expect(() => sanitizeConstellationData({ stars: [star('a', { description: 'x'.repeat(2001) })] })).toThrow(/опис/);
  });

  it('rejects more than the maximum number of stars', () => {
    const stars = Array.from({ length: MAX_STARS + 1 }, (_, i) => star(`s${i}`));
    expect(() => sanitizeConstellationData({ stars })).toThrow(/максимум/);
  });

  it('rejects lines to unknown stars and self-loops', () => {
    const stars = [star('a'), star('b')];
    expect(() => sanitizeConstellationData({ stars, lines: [{ a: 'a', b: 'zzz' }] })).toThrow(/неіснуючу/);
    expect(() => sanitizeConstellationData({ stars, lines: [{ a: 'a', b: 'a' }] })).toThrow(/саму з собою/);
  });

  it('silently drops duplicate lines, including the reversed pair', () => {
    const { lines } = sanitizeConstellationData({
      stars: [star('a'), star('b')],
      lines: [{ a: 'a', b: 'b' }, { a: 'b', b: 'a' }, { a: 'a', b: 'b' }],
    });
    expect(lines).toEqual([{ a: 'a', b: 'b' }]);
  });

  it('rejects non-array stars and non-object data', () => {
    expect(() => sanitizeConstellationData({ stars: 'nope' })).toThrow(/масив/);
    expect(() => sanitizeConstellationData([])).toThrow(/об'єкт/);
  });
});
