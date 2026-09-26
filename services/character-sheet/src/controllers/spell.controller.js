const SpellProgressModel = require('../models/spell.model');
const { checkPrerequisites, isVisibleToUser } = require('../models/prerequisite.model');
const authorizeCharacterWrite = require('./authorize-character-write');

// level приходить з тіла запиту: ціле від 1 до кількості рівнів заклинання.
async function isValidLevel(spellId, level) {
  if (!Number.isInteger(level) || level < 1) return false;
  const count = await SpellProgressModel.levelCount(spellId);
  return count != null && level <= count;
}

const SpellController = {
  async list(req, res) {
    const spells = await SpellProgressModel.findAll(req.params.id);
    res.json({ spells });
  },

  async add(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const { spell_id } = req.body;
    if (!spell_id) return res.status(400).json({ message: 'spell_id є обовʼязковим' });
    if (!await isVisibleToUser('spellbook.spells', spell_id, req.user.sub)) {
      return res.status(404).json({ message: 'Заклинання не знайдено' });
    }
    const { met, missing } = await checkPrerequisites(req.params.id, 'spellbook.spells', spell_id);
    if (!met) return res.status(403).json({ message: 'Не виконано вимоги дерева розвитку', missing_node_ids: missing });
    const level = req.body.level ?? 1;
    if (!await isValidLevel(spell_id, level)) {
      return res.status(400).json({ message: 'Некоректний рівень заклинання' });
    }
    const entry = await SpellProgressModel.add(req.params.id, spell_id, level);
    res.status(201).json({ spell: entry });
  },

  async patch(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const { mastered, cast_count, level } = req.body;
    if (level !== undefined && !await isValidLevel(req.params.spellId, level)) {
      return res.status(400).json({ message: 'Некоректний рівень заклинання' });
    }
    const updated = await SpellProgressModel.patch(req.params.id, req.params.spellId, { mastered, cast_count, level });
    if (!updated) return res.status(404).json({ message: 'Заклинання не знайдено в листі' });
    res.json({ spell: updated });
  },

  async remove(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const deleted = await SpellProgressModel.remove(req.params.id, req.params.spellId);
    if (!deleted) return res.status(404).json({ message: 'Заклинання не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = SpellController;
