const CharacterModel = require('../models/character.model');
const SkillModel = require('../models/skill.model');

async function assertOwner(req, res) {
  const char = await CharacterModel.findById(req.params.id);
  if (!char) { res.status(404).json({ message: 'Персонажа не знайдено' }); return null; }
  if (char.user_id !== req.user.sub) { res.status(403).json({ message: 'Доступ заборонено' }); return null; }
  return char;
}

const SkillController = {
  async getAll(req, res) {
    const char = await CharacterModel.findById(req.params.id);
    if (!char) return res.status(404).json({ message: 'Персонажа не знайдено' });
    const isOwner = char.user_id === req.user.sub;
    const isGM = req.user.role === 'game_master';
    if (!isOwner && !isGM && !char.is_public) return res.status(403).json({ message: 'Доступ заборонено' });

    const skills = await SkillModel.findAll(req.params.id);
    res.json({ skills });
  },

  async patch(req, res) {
    if (!await assertOwner(req, res)) return;
    const { value, progress_marks } = req.body;
    const skill = await SkillModel.patch(req.params.id, req.params.key, { value, progress_marks });
    if (!skill) return res.status(404).json({ message: 'Навичку не знайдено' });
    res.json({ skill });
  },

  // Bulk update for initial distribution or mass edit
  async bulkUpdate(req, res) {
    if (!await assertOwner(req, res)) return;
    const { updates } = req.body; // [{skill_key, value, progress_marks}]
    if (!Array.isArray(updates)) return res.status(400).json({ message: 'updates повинен бути масивом' });
    const skills = await SkillModel.bulkUpdate(req.params.id, updates);
    res.json({ skills });
  },
};

module.exports = SkillController;
