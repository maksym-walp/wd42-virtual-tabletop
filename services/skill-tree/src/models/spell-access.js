// Що вузол відкриває для заклинань: найвищу складність — драбиною, тобто
// разом з усіма нижчими (міграція 123; традиції раніше теж відкривались
// деревом, тепер гравець позначає їх сам у меню чарів персонажа —
// character_sheet.characters.open_traditions). Окремі заклинання вузли
// не видають і не відкривають.
const COMPLEXITIES = ['primitive', 'simple', 'medium', 'complex', 'extreme'];

function sanitizeComplexity(value) {
  return COMPLEXITIES.includes(value) ? value : null;
}

module.exports = { COMPLEXITIES, sanitizeComplexity };
