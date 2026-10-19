// Рівень зірки (1–3) → радіус у світових одиницях полотна і підпис.
export const STAR_LEVELS = {
  1: { r: 5, label: 'Мала' },
  2: { r: 8, label: 'Середня' },
  3: { r: 12, label: 'Велика' },
};

export const MAX_STARS = 200;

// crypto.randomUUID є лише в безпечному контексті (https/localhost); у dev по
// IP-адресі в локальній мережі його немає — тоді запасний варіант.
export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyConstellation() {
  return { name: '', description: '', gm_notes: '', is_public: false, stars: [], lines: [] };
}

export function newStar(x, y, index) {
  return { id: newId(), x: Math.round(x), y: Math.round(y), size: 2, name: `Зірка ${index}`, description: '' };
}

// Рамка зірок: { minX, minY, maxX, maxY } або null, якщо їх немає.
export function boundsOf(stars) {
  if (!stars.length) return null;
  const xs = stars.map((s) => s.x);
  const ys = stars.map((s) => s.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

// Проєкція документа сервера в стан редактора й назад (зайве відкидаємо).
export function fromServer(item) {
  return {
    name: item.name,
    description: item.description || '',
    gm_notes: item.gm_notes || '',
    is_public: item.is_public,
    stars: item.data?.stars ?? [],
    lines: item.data?.lines ?? [],
  };
}

export function toPayload(doc) {
  return {
    name: doc.name.trim(),
    description: doc.description.trim(),
    gm_notes: doc.gm_notes.trim(),
    is_public: doc.is_public,
    data: { stars: doc.stars, lines: doc.lines },
  };
}
