// Generates the PWA icon set (192/512/maskable/apple-touch/favicon) from
// scratch as flat-color PNGs — no image libraries, no external assets.
// Run: node scripts/generate-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [0x1a, 0x19, 0x29]; // #1a1929 — matches .card / navbar background
const FG = [0xc9, 0xa8, 0x4c]; // #c9a84c — matches accent gold used for links/logo

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: truecolor + alpha
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0 (none) per scanline
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idatData = zlib.deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdrData),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function setPixel(rgba, width, x, y, color) {
  if (x < 0 || y < 0 || x >= width) return;
  const i = (y * width + x) * 4;
  rgba[i] = color[0];
  rgba[i + 1] = color[1];
  rgba[i + 2] = color[2];
  rgba[i + 3] = 255;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function strokePolyline(rgba, width, height, points, strokeWidth, color) {
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (const [x, y] of points) {
    minX = Math.min(minX, x - strokeWidth);
    minY = Math.min(minY, y - strokeWidth);
    maxX = Math.max(maxX, x + strokeWidth);
    maxY = Math.max(maxY, y + strokeWidth);
  }
  minX = Math.max(0, Math.floor(minX));
  minY = Math.max(0, Math.floor(minY));
  maxX = Math.min(width - 1, Math.ceil(maxX));
  maxY = Math.min(height - 1, Math.ceil(maxY));

  const r = strokeWidth / 2;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      for (let s = 0; s < points.length - 1; s++) {
        const [x1, y1] = points[s];
        const [x2, y2] = points[s + 1];
        if (distToSegment(x + 0.5, y + 0.5, x1, y1, x2, y2) <= r) {
          setPixel(rgba, width, x, y, color);
          break;
        }
      }
    }
  }
}

// Stylized "W" — normalized 0..1 coordinates, scaled+centered per icon.
const W_POINTS = [
  [0.16, 0.30], [0.34, 0.72], [0.50, 0.42], [0.66, 0.72], [0.84, 0.30],
];

function makeIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = BG[0];
    rgba[i * 4 + 1] = BG[1];
    rgba[i * 4 + 2] = BG[2];
    rgba[i * 4 + 3] = 255;
  }

  // Maskable icons get extra padding so the glyph survives circular/squircle crops.
  const glyphScale = maskable ? 0.5 : 0.72;
  const offset = (1 - glyphScale) / 2;
  const points = W_POINTS.map(([x, y]) => [
    (offset + x * glyphScale) * size,
    (offset + y * glyphScale) * size,
  ]);
  strokePolyline(rgba, size, size, points, size * 0.09, FG);

  return encodePNG(size, size, rgba);
}

function makeFavicon() {
  // Minimal ICO container wrapping a single 32x32 PNG (supported by all
  // modern browsers; avoids reimplementing legacy BMP-in-ICO encoding).
  const png = makeIcon(32);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry[0] = 32; // width
  entry[1] = 32; // height
  entry[2] = 0; // palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // image data size
  entry.writeUInt32LE(header.length + entry.length, 12); // offset

  return Buffer.concat([header, entry, png]);
}

const outDir = path.join(__dirname, '..', 'public');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), makeIcon(192));
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), makeIcon(512));
fs.writeFileSync(path.join(outDir, 'maskable-icon-512x512.png'), makeIcon(512, { maskable: true }));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), makeIcon(180));
fs.writeFileSync(path.join(outDir, 'favicon.ico'), makeFavicon());

console.log('Icons written to', outDir);
