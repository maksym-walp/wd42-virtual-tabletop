const { resolveTarget } = require('../resolve-target');

const DIR = '/uploads';
const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

function expectBadRequest(fn) {
  expect(fn).toThrow();
  try { fn(); } catch (err) { expect(err.statusCode).toBe(400); }
}

describe('valid targets', () => {
  it('maps campaign-gallery under the campaign id', () => {
    expect(resolveTarget('campaign-gallery', UUID, DIR)).toEqual({
      relDir: `campaigns/${UUID}/gallery`,
      absDir: `/uploads/campaigns/${UUID}/gallery`,
    });
  });

  it('maps character under the character id', () => {
    expect(resolveTarget('character', UUID, DIR)).toEqual({
      relDir: `characters/${UUID}`,
      absDir: `/uploads/characters/${UUID}`,
    });
  });

  it('maps item to a flat directory and ignores entity_id entirely', () => {
    expect(resolveTarget('item', undefined, DIR).relDir).toBe('items');
    expect(resolveTarget('item', '../../etc', DIR).relDir).toBe('items');
  });
});

describe('entity_type whitelist', () => {
  it('rejects an unknown type', () => {
    expectBadRequest(() => resolveTarget('campaigns', UUID, DIR));
  });

  // `in` would let these through via the prototype chain — hasOwnProperty won't.
  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'rejects prototype key %s',
    (key) => expectBadRequest(() => resolveTarget(key, UUID, DIR))
  );

  it.each([undefined, null, 42, {}, []])('rejects non-string type %p', (val) => {
    expectBadRequest(() => resolveTarget(val, UUID, DIR));
  });
});

describe('entity_id validation', () => {
  it.each(['campaign-gallery', 'character'])('requires an id for %s', (type) => {
    expectBadRequest(() => resolveTarget(type, undefined, DIR));
  });

  it.each([
    ['traversal',        '../../etc'],
    ['nested traversal', '..%2F..%2Fetc'],
    ['path separator',   'a/b'],
    ['absolute path',    '/etc/passwd'],
    ['backslash',        'a\\b'],
    ['NUL byte',         'x\0.png'],
    ['empty string',     ''],
    ['36 non-uuid chars', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
    ['uuid with slash',  `${UUID}/..`],
    ['nil uuid v0',      '00000000-0000-0000-0000-000000000000'],
  ])('rejects %s', (_label, id) => {
    expectBadRequest(() => resolveTarget('character', id, DIR));
  });

  it.each([undefined, null, 42, {}])('rejects non-string id %p', (val) => {
    expectBadRequest(() => resolveTarget('character', val, DIR));
  });
});

it('never produces a path outside the upload dir', () => {
  const { absDir } = resolveTarget('campaign-gallery', UUID, DIR);
  expect(absDir.startsWith('/uploads/')).toBe(true);
  expect(absDir).not.toContain('..');
});
