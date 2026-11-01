// Альтернативна навичка чарування (міграція 119): для заклинань обраної
// традиції вузол дозволяє гравцю кастувати не Чаруванням, а навичкою
// skill_key. Окремо від nodes.modifiers — там target завжди фіксована
// навичка, яку підсилює ефект; тут натомість традиція заклинань змінює
// саму навичку перевірки, а вибір між варіантами лишається за гравцем
// (character-sheet лише повертає весь список варіантів).
//
// Валідація, як і в spell-access.js/node-modifier.js, навмисно «тиха»:
// невідома традиція чи навичка просто відкидається, а не валить запит.

const crypto = require('crypto');
const { SKILL_TARGETS } = require('./node-modifier');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NOTE = 200;

function sanitizeOne(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const tradition_id = typeof raw.tradition_id === 'string' && UUID_RE.test(raw.tradition_id) ? raw.tradition_id : null;
  if (!tradition_id) return null;

  const skill_key = SKILL_TARGETS.includes(raw.skill_key) ? raw.skill_key : null;
  if (!skill_key) return null;

  const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, MAX_NOTE) : '';

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : crypto.randomUUID(),
    tradition_id,
    skill_key,
    note,
  };
}

function sanitizeCastSkillOptions(list) {
  return (Array.isArray(list) ? list : []).map(sanitizeOne).filter(Boolean);
}

module.exports = { sanitizeCastSkillOptions };
