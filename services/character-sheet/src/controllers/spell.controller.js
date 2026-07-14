const CharacterModel = require('../models/character.model');
const SpellProgressModel = require('../models/spell.model');
const { checkPrerequisites, isVisibleToUser } = require('../models/prerequisite.model');

async function assertOwner(req, res) {
  const char = await CharacterModel.findById(req.params.id);
  if (!char) { res.status(404).json({ message: 'Персонажа не знайдено' }); return null; }
  if (char.user_id !== req.user.sub) { res.status(403).json({ message: 'Доступ заборонено' }); return null; }
  return char;
}

const SpellController = {
  async list(req, res) {
    const spells = await SpellProgressModel.findAll(req.params.id);
    res.json({ spells });
  },

  async add(req, res) {
    if (!await assertOwner(req, res)) return;
    const { spell_id } = req.body;
    if (!spell_id) return res.status(400).json({ message: 'spell_id є обовʼязковим' });
    if (!await isVisibleToUser('spellbook.spells', spell_id, req.user.sub)) {
      return res.status(404).json({ message: 'Заклинання не знайдено' });
    }
    const { met, missing } = await checkPrerequisites(req.params.id, 'spellbook.spells', spell_id);
    if (!met) return res.status(403).json({ message: 'Не виконано вимоги дерева розвитку', missing_node_ids: missing });
    const entry = await SpellProgressModel.add(req.params.id, spell_id);
    res.status(201).json({ spell: entry });
  },

  async patch(req, res) {
    if (!await assertOwner(req, res)) return;
    const { mastered, cast_count } = req.body;
    const updated = await SpellProgressModel.patch(req.params.id, req.params.spellId, { mastered, cast_count });
    if (!updated) return res.status(404).json({ message: 'Заклинання не знайдено в листі' });
    res.json({ spell: updated });
  },

  async remove(req, res) {
    if (!await assertOwner(req, res)) return;
    const deleted = await SpellProgressModel.remove(req.params.id, req.params.spellId);
    if (!deleted) return res.status(404).json({ message: 'Заклинання не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = SpellController;
