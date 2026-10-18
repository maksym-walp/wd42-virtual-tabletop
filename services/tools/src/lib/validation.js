const MAX_URL_LENGTH = 500; // = VARCHAR(500) у схемі
const MAX_ID_LENGTH = 50;

// 400-помилка валідації: statusCode підхоплює спільний обробник помилок, а
// контролер ловить її і відповідає сам, щоб тіло було { message } як скрізь.
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

// Обрізаний рядок; null/undefined → ''. Надто довгий — помилка, а не мовчазне
// обрізання, щоб користувач бачив, що текст не влізе.
function cleanText(value, max, field) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new ValidationError(`${field}: очікується рядок`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ValidationError(`${field}: максимум ${max} символів`);
  return trimmed;
}

function requireText(value, max, field) {
  const text = cleanText(value, max, field);
  if (!text) throw new ValidationError(`${field}: обов'язкове поле`);
  return text;
}

// Ідентифікатор елемента всередині документа (зірка, масть, карта): довільний
// короткий рядок, унікальність перевіряє той, хто викликає.
function cleanId(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_ID_LENGTH) {
    throw new ValidationError(`${field}: потрібен id (рядок до ${MAX_ID_LENGTH} символів)`);
  }
  return value;
}

// Приймаємо або власний upload (/uploads/...), або зовнішній https-URL.
// Це відсікає javascript: і data: — вони інакше потрапили б у <img src>.
function isAllowedImageUrl(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_URL_LENGTH
    && (value.startsWith('/uploads/') || value.startsWith('https://'));
}

// Порожнє значення → null; інакше обов'язково дозволений URL.
function cleanImageUrl(value, field) {
  if (value == null || value === '') return null;
  if (!isAllowedImageUrl(value)) throw new ValidationError(`${field}: недозволене посилання на зображення`);
  return value;
}

function requireArray(value, max, field) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new ValidationError(`${field}: очікується масив`);
  if (value.length > max) throw new ValidationError(`${field}: максимум ${max} елементів`);
  return value;
}

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${field}: очікується об'єкт`);
  }
  return value;
}

module.exports = {
  ValidationError, cleanText, requireText, cleanId, cleanImageUrl, isAllowedImageUrl, requireArray, requireObject,
  MAX_URL_LENGTH,
};
