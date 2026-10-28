const { computeEffects } = require('./conditions');
const { timerView } = require('./timer');
const { potionView } = require('./potions');

// Обчислені блоки, які лист персонажа додає до відповіді.
function sheetDerived(character, skills) {
  return {
    effects: computeEffects(character.conditions, skills, character.archetype, character),
    timer: timerView(character),
    potions: potionView(character),
  };
}

module.exports = { sheetDerived };
