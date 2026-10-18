const {
  ValidationError, cleanText, cleanId, requireArray, requireObject,
} = require('./validation');

const MAX_STARS = 200;
const MAX_LINES = 500;
const MAX_COORD = 100000;

function cleanCoord(value, field) {
  const n = Number(value);
  if (value === null || value === '' || !Number.isFinite(n) || Math.abs(n) > MAX_COORD) {
    throw new ValidationError(`${field}: очікується число в межах ±${MAX_COORD}`);
  }
  return Math.round(n * 100) / 100;
}

// Документ сузір'я: { stars: [{ id, x, y, size 1–3, name, description }],
// lines: [{ a, b }] } — a/b це id зірок. Повертає очищену копію; усе, чого
// немає в схемі, відкидається.
function sanitizeConstellationData(raw) {
  const data = requireObject(raw ?? {}, 'data');
  const rawStars = requireArray(data.stars, MAX_STARS, 'stars');
  const rawLines = requireArray(data.lines, MAX_LINES, 'lines');

  const ids = new Set();
  const stars = rawStars.map((star, i) => {
    const field = `Зірка №${i + 1}`;
    requireObject(star, field);
    const id = cleanId(star.id, field);
    if (ids.has(id)) throw new ValidationError(`${field}: id "${id}" повторюється`);
    ids.add(id);

    const size = Number(star.size);
    if (!Number.isInteger(size) || size < 1 || size > 3) {
      throw new ValidationError(`${field}: рівень має бути 1, 2 або 3`);
    }
    return {
      id,
      x: cleanCoord(star.x, `${field}, x`),
      y: cleanCoord(star.y, `${field}, y`),
      size,
      name: cleanText(star.name, 100, `${field}, назва`),
      description: cleanText(star.description, 2000, `${field}, опис`),
    };
  });

  // Лінія A–B і B–A — та сама лінія: дублі мовчки відкидаємо (редактор їх не
  // створює, а імпорт з чужого файлу не варто валити через це).
  const seen = new Set();
  const lines = [];
  rawLines.forEach((line, i) => {
    const field = `Лінія №${i + 1}`;
    requireObject(line, field);
    const { a, b } = line;
    if (!ids.has(a) || !ids.has(b)) throw new ValidationError(`${field}: посилається на неіснуючу зірку`);
    if (a === b) throw new ValidationError(`${field}: лінія не може з'єднувати зірку саму з собою`);
    const key = [a, b].sort().join('\u0000');
    if (seen.has(key)) return;
    seen.add(key);
    lines.push({ a, b });
  });

  return { stars, lines };
}

module.exports = { sanitizeConstellationData, MAX_STARS, MAX_LINES };
