// file.mimetype приходить від клієнта, тож самому йому вірити не можна.
// Буфер уже в пам'яті (memoryStorage), тож звірка сигнатури коштує майже
// нічого — і саме вона зупиняє SVG чи HTML, оголошений як image/png.
const SIGNATURES = {
  'image/jpeg': (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png':  (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/gif':  (b) => b.length >= 6 && b.subarray(0, 4).toString('ascii') === 'GIF8',
  // WebP — контейнер RIFF: 'RIFF' на 0, розмір на 4, 'WEBP' на 8.
  'image/webp': (b) => b.length >= 12
    && b.subarray(0, 4).toString('ascii') === 'RIFF'
    && b.subarray(8, 12).toString('ascii') === 'WEBP',
};

/** Чи відповідають реальні байти оголошеному MIME-типу. */
function sniff(buffer, declaredMime) {
  const check = SIGNATURES[declaredMime];
  if (!check || !Buffer.isBuffer(buffer)) return false;
  return check(buffer);
}

module.exports = { sniff, SIGNATURES };
