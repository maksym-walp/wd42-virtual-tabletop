const authorizeCharacterWrite = require('./authorize-character-write');
const CharacterStateModel = require('../models/character-state.model');
const EquipmentModel = require('../models/equipment.model');
const { drinkPotion, consumeStock, MAX_PORTIONS_PER_DRINK } = require('../rules/potions');
const { sheetDerived } = require('../rules');
const { treeModifiers } = require('../models/tree-modifiers.model');

const PotionController = {
  // POST /:id/equipment/:equipmentId/drink { portions } — випити кілька порцій
  // зілля з запасу персонажа (власник, ГМ кампанії або адмін). Зцілення,
  // звикання й перевірку Імунітету рахує rules/potions.js; порожнє зілля
  // зникає з листа (item: null у відповіді).
  async drink(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;

    const portions = Number(req.body.portions);
    if (!Number.isInteger(portions) || portions < 1 || portions > MAX_PORTIONS_PER_DRINK) {
      return res.status(400).json({ message: `portions — ціле від 1 до ${MAX_PORTIONS_PER_DRINK}` });
    }

    const out = await CharacterStateModel.withCharacterLock(req.params.id, async (client, state) => {
      const entry = await EquipmentModel.findPotionForUpdate(client, req.params.id, req.params.equipmentId);
      if (!entry) return { missing: true };
      if (entry.item.effect !== 'healing' || !entry.item.heal_die || !entry.item.portions) {
        const err = new Error('Це зілля поки не можна випити');
        err.statusCode = 400;
        throw err;
      }

      const stock = consumeStock(entry, entry.item.portions, portions);
      const { result, fields } = drinkPotion(state, { healDie: entry.item.heal_die, portions });
      const character = await CharacterStateModel.saveState(client, req.params.id, fields);
      const item = await EquipmentModel.saveStock(client, req.params.id, req.params.equipmentId, stock);
      return {
        result: { ...result, potion: { equipment_id: entry.equipment_id, name: entry.item.name }, stock },
        character,
        item: item ? { ...item, item: entry.item } : null,
        skills: state.skills,
      };
    });
    if (!out) return res.status(404).json({ message: 'Персонажа не знайдено' });
    if (out.missing) return res.status(404).json({ message: 'Цього зілля немає в листі' });

    res.json({ result: out.result, character: out.character, item: out.item, ...sheetDerived(out.character, out.skills, await treeModifiers(out.character.id)) });
  },
};

module.exports = PotionController;
