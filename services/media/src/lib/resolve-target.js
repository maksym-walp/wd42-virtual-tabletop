const path = require('path');

// Куди лягає файл залежно від метаданих. Ключі — це єдині значення
// entity_type, які сервіс приймає взагалі: усе інше відхиляється до того,
// як хоч щось торкнеться диска.
const TARGETS = {
  'campaign-gallery': { requiresId: true,  dir: (id) => `campaigns/${id}/gallery` },
  'character':        { requiresId: true,  dir: (id) => `characters/${id}` },
  'item':             { requiresId: false, dir: () => 'items' },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

/**
 * Перетворює метадані запиту на відносну теку всередині uploadDir.
 * Три незалежні шари захисту від path traversal — кожен сам по собі
 * достатній, разом вони переживуть недбалу зміну в майбутньому.
 */
function resolveTarget(entityType, entityId, uploadDir) {
  // 1. Whitelist. hasOwnProperty, а не `in` — інакше 'constructor' і
  //    '__proto__' пройшли б перевірку через ланцюг прототипів.
  if (typeof entityType !== 'string' || !Object.prototype.hasOwnProperty.call(TARGETS, entityType)) {
    throw badRequest('Невідомий тип обʼєкта');
  }

  const target = TARGETS[entityType];

  // 2. UUID-регекс. Саме він робить '..', '/', '\' і NUL структурно
  //    неможливими в сегменті шляху — жодного санітайзингу не потрібно.
  if (target.requiresId && (typeof entityId !== 'string' || !UUID_RE.test(entityId))) {
    throw badRequest('Некоректний ідентифікатор обʼєкта');
  }

  const relDir = target.dir(entityId);

  // 3. Assert вкладеності. Страховка на випадок, якщо хтось колись додасть
  //    сюди новий target із менш суворим шаблоном.
  const absDir = path.resolve(uploadDir, relDir);
  if (absDir !== path.join(uploadDir, relDir) || !absDir.startsWith(uploadDir + path.sep)) {
    throw badRequest('Некоректний шлях призначення');
  }

  return { relDir, absDir };
}

module.exports = { resolveTarget, TARGETS, UUID_RE };
