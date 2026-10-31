const { computeEffects } = require('./conditions');
const { timerView } = require('./timer');
const { potionView } = require('./potions');
const { rollProfiles } = require('./modifiers');

// Обчислені блоки, які лист персонажа додає до відповіді.
//
// treeModifiers — модифікатори відкритих вузлів дерева
// (models/tree-modifiers.model.js). Правила лишаються чистими: читає БД
// контролер, сюди список приходить уже готовим. Без нього профілі кидків
// усе одно рахуються — просто без внеску дерева.
function sheetDerived(character, skills, treeModifiers = []) {
  const effects = computeEffects(character.conditions, skills, character.archetype, character);
  return {
    effects,
    timer: timerView(character),
    potions: potionView(character),
    // Як саме кидати кожну перевірку зараз: кубик, режим і бонус з
    // урахуванням і станів, і дерева (rules/modifiers.js).
    roll_profiles: rollProfiles(treeModifiers, effects, skills),
  };
}

module.exports = { sheetDerived };
