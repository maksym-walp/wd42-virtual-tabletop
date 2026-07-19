const { sniff } = require('../sniff');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const PNG  = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const GIF  = Buffer.concat([Buffer.from('GIF89a', 'ascii'), Buffer.alloc(6)]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'), Buffer.alloc(4), Buffer.from('WEBP', 'ascii'),
]);
const SVG  = Buffer.from('<svg onload="alert(1)"></svg>', 'utf8');

describe('accepts matching signatures', () => {
  it.each([
    ['image/jpeg', JPEG],
    ['image/png',  PNG],
    ['image/gif',  GIF],
    ['image/webp', WEBP],
  ])('%s', (mime, buf) => expect(sniff(buf, mime)).toBe(true));
});

describe('rejects mismatched content', () => {
  it('rejects PNG bytes declared as JPEG', () => {
    expect(sniff(PNG, 'image/jpeg')).toBe(false);
  });

  // The attack this whole module exists for.
  it('rejects SVG bytes declared as PNG', () => {
    expect(sniff(SVG, 'image/png')).toBe(false);
  });

  it('rejects HTML declared as GIF', () => {
    expect(sniff(Buffer.from('<html>', 'utf8'), 'image/gif')).toBe(false);
  });

  it('rejects a RIFF container that is not WEBP (e.g. a .wav)', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF', 'ascii'), Buffer.alloc(4), Buffer.from('WAVE', 'ascii'),
    ]);
    expect(sniff(wav, 'image/webp')).toBe(false);
  });
});

describe('degrades safely', () => {
  it.each([
    ['empty',     Buffer.alloc(0)],
    ['truncated', Buffer.from([0xff, 0xd8])],
    ['short webp', Buffer.from('RIFF', 'ascii')],
  ])('returns false without throwing on a %s buffer', (_label, buf) => {
    expect(() => sniff(buf, 'image/webp')).not.toThrow();
    expect(sniff(buf, 'image/jpeg')).toBe(false);
  });

  it('rejects an unknown declared mime', () => {
    expect(sniff(PNG, 'image/svg+xml')).toBe(false);
    expect(sniff(PNG, 'application/octet-stream')).toBe(false);
  });

  it('rejects a non-buffer', () => {
    expect(sniff('not a buffer', 'image/png')).toBe(false);
    expect(sniff(null, 'image/png')).toBe(false);
  });
});
