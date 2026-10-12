export const HEX_RE = /^#[0-9a-f]{6}$/i;

const channel = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);

function luminance(hex) {
  const [r, g, b] = [0, 1, 2].map((i) => {
    const c = channel(hex, i) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const toHex = (n) => Math.round(n).toString(16).padStart(2, '0');

// Lightens `hex` toward white until it reaches ~4.8:1 contrast against the
// dark theme's #1e1e1e background (which is also the text color on bg-accent
// buttons), so a user-picked navy or black accent never becomes unreadable.
export function readableOnDark(hex) {
  let current = hex.toLowerCase();
  for (let i = 0; i < 20 && luminance(current) < 0.25; i += 1) {
    current = `#${[0, 1, 2].map((c) => toHex(channel(current, c) + (255 - channel(current, c)) * 0.08)).join('')}`;
  }
  return current;
}
