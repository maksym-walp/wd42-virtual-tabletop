// Кадрування зображення запису (image_crop, JSONB): що саме показувати, коли
// картинка обрізається під форму картки. x/y — центр кадру у % від
// зображення, zoom — наближення (1 = кадр на всю ширину/висоту), ratio —
// пропорції оригіналу (ширина / висота), потрібні фронтенду, щоб перерахувати
// кадр під будь-яку форму. Однаковий файл у кожному сервісі з зображеннями.
//
// Повертає JSON-рядок для параметра `$n::jsonb` або null — і для «не
// задано», і для некоректного значення (тоді показ просто по центру).
function serializeImageCrop(value) {
  if (!value || typeof value !== 'object') return null;
  const { x, y, zoom, ratio } = value;
  const numbers = [x, y, zoom, ratio].every((n) => typeof n === 'number' && Number.isFinite(n));
  if (!numbers) return null;
  if (x < 0 || x > 100 || y < 0 || y > 100 || zoom < 1 || zoom > 5 || ratio <= 0 || ratio > 20) return null;
  return JSON.stringify({ x, y, zoom, ratio });
}

module.exports = { serializeImageCrop };
