// Альтернативна навичка чарування (міграція 119, форма магії — 124): для
// заклинань обраної форми магії вузол дозволяє гравцю кастувати не
// Чаруванням, а навичкою skill_key. Окремо від nodes.modifiers — там target
// завжди фіксована навичка, яку підсилює ефект; тут натомість форма
// заклинань змінює саму навичку перевірки, а вибір між варіантами
// лишається за гравцем (character-sheet лише повертає весь список варіантів).
//
// Набір форм магії фіксований (дзеркалить spellbook.spells.nature CHECK,
// міграція 93) — адмін редагує лише назви й описи (admin.site_configs,
// ключ magic_forms), не самі ключі.
//
// Валідація, як і в spell-access.js/node-modifier.js, навмисно «тиха»:
// невідома форма чи навичка просто відкидається, а не валить запит.

const crypto = require('crypto');
const { SKILL_TARGETS } = require('./node-modifier');

const MAGIC_FORMS = ['arcana', 'elemental', 'integral', 'pact', 'nature', 'blight'];
const MAX_NOTE = 200;

function sanitizeOne(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const magic_form = MAGIC_FORMS.includes(raw.magic_form) ? raw.magic_form : null;
  if (!magic_form) return null;

  const skill_key = SKILL_TARGETS.includes(raw.skill_key) ? raw.skill_key : null;
  if (!skill_key) return null;

  const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, MAX_NOTE) : '';

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : crypto.randomUUID(),
    magic_form,
    skill_key,
    note,
  };
}

function sanitizeCastSkillOptions(list) {
  return (Array.isArray(list) ? list : []).map(sanitizeOne).filter(Boolean);
}

module.exports = { MAGIC_FORMS, sanitizeCastSkillOptions };
