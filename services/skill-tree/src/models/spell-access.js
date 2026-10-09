// Що вузол відкриває для заклинань (міграція 91): традиції
// (spellbook.traditions.id — голі cross-service uuid, без FK) і найвищу
// складність — драбиною, тобто разом з усіма нижчими. Окремі заклинання
// вузли більше не видають і не відкривають.
const COMPLEXITIES = ['primitive', 'simple', 'medium', 'complex', 'extreme'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeTraditions(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string' && UUID_RE.test(id)))];
}

function sanitizeComplexity(value) {
  return COMPLEXITIES.includes(value) ? value : null;
}

module.exports = { COMPLEXITIES, sanitizeTraditions, sanitizeComplexity };
