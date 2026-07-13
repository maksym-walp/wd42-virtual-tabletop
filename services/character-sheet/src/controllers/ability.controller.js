const CharacterModel = require('../models/character.model');
const AbilityModel = require('../models/ability.model');
const { checkPrerequisites } = require('../models/prerequisite.model');

async function assertOwner(req, res) {
  const char = await CharacterModel.findById(req.params.id);
  if (!char) { res.status(404).json({ message: 'Персонажа не знайдено' }); return null; }
  if (char.user_id !== req.user.sub) { res.status(403).json({ message: 'Доступ заборонено' }); return null; }
  return char;
}

const AbilityController = {
  async list(req, res) {
    const abilities = await AbilityModel.findAll(req.params.id);
    res.json({ abilities });
  },

  async add(req, res) {
    if (!await assertOwner(req, res)) return;
    const { ability_id } = req.body;
    if (!ability_id) return res.status(400).json({ message: 'ability_id є обовʼязковим' });
    const { met, missing } = await checkPrerequisites(req.params.id, 'abilities.entries', ability_id);
    if (!met) return res.status(403).json({ message: 'Не виконано вимоги дерева розвитку', missing_node_ids: missing });
    const ability = await AbilityModel.add(req.params.id, ability_id);
    res.status(201).json({ ability });
  },

  async remove(req, res) {
    if (!await assertOwner(req, res)) return;
    const deleted = await AbilityModel.remove(req.params.id, req.params.abilityId);
    if (!deleted) return res.status(404).json({ message: 'Вміння не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = AbilityController;
