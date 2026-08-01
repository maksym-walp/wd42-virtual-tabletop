// Regenerates every favicon/PWA/navbar icon in public/ from branding/logo.png.
// Run via `npm run icons` after replacing the logo — filenames and sizes are
// fixed to match what index.html, vite.config.mjs's PWA manifest, and
// Navbar.jsx expect, so nothing else needs to change. See branding/README.md.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const toIco = require('to-ico');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'branding', 'logo.png');
const PUBLIC = path.join(ROOT, 'public');

// Matches manifest.background_color in vite.config.mjs — the maskable icon
// and the (alpha-less) apple-touch-icon are flattened onto this so they
// never show a black or transparent halo around the logo.
const BACKGROUND = '#f4efe4';
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(
      `Немає вихідного логотипу: ${path.relative(ROOT, SOURCE)}\n` +
      'Поклади квадратний PNG (бажано ≥1024×1024, прозорий фон) під назвою ' +
      'logo.png у branding/ і запусти "npm run icons" ще раз.'
    );
    process.exitCode = 1;
    return;
  }
  fs.mkdirSync(PUBLIC, { recursive: true });
  // No ensureAlpha() here on purpose: resize's transparent `background` fill
  // already gives the square icons an alpha channel where wanted, and
  // forcing alpha up front would survive flatten() below, leaving the
  // "opaque" apple-touch-icon with a (harmless but spec-incorrect) alpha channel.
  const source = sharp(SOURCE);

  const square = async (size) =>
    source.clone().resize(size, size, { fit: 'contain', background: TRANSPARENT }).png().toBuffer();

  // Navbar logo — natural aspect ratio, no padding to a square, just capped
  // to a sane max size so it stays crisp next to the "Walp" wordmark.
  await source.clone()
    .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
    .png().toFile(path.join(PUBLIC, 'logo.png'));

  fs.writeFileSync(path.join(PUBLIC, 'pwa-192x192.png'), await square(192));
  fs.writeFileSync(path.join(PUBLIC, 'pwa-512x512.png'), await square(512));

  // Apple ignores alpha on touch icons and renders transparency as black —
  // flatten onto the theme background instead of leaving it transparent.
  await source.clone()
    .resize(180, 180, { fit: 'contain', background: BACKGROUND })
    .flatten({ background: BACKGROUND })
    .png().toFile(path.join(PUBLIC, 'apple-touch-icon.png'));

  // Maskable icon: OSes crop this to a circle/rounded-square, so anything
  // outside the inner ~80% "safe zone" gets clipped. Scale the logo to 60%
  // of the canvas and center it on an opaque background to leave a safe
  // margin against every mask shape.
  const maskableLogo = await source.clone()
    .resize(307, 307, { fit: 'contain', background: TRANSPARENT })
    .toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: BACKGROUND } })
    .composite([{ input: maskableLogo, gravity: 'center' }])
    .png().toFile(path.join(PUBLIC, 'maskable-icon-512x512.png'));

  // favicon.ico — an actual multi-resolution ICO container (16/32/48), not a
  // PNG renamed to .ico, so it stays spec-correct for browsers/tools that
  // parse the ICO format directly instead of sniffing content.
  const icoSizes = [16, 32, 48];
  const icoFrames = await Promise.all(icoSizes.map(square));
  fs.writeFileSync(path.join(PUBLIC, 'favicon.ico'), await toIco(icoFrames));

  console.log(
    'Іконки згенеровано в public/: logo.png, pwa-192x192.png, pwa-512x512.png, ' +
    'maskable-icon-512x512.png, apple-touch-icon.png, favicon.ico'
  );
}

main();
