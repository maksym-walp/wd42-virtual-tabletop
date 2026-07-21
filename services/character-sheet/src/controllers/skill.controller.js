const CharacterModel = require('../models/character.model');
const SkillModel = require('../models/skill.model');
const authorizeCharacterWrite = require('./authorize-character-write');
const { isCampaignGmForCharacter } = require('../models/campaign-access.model');

const SkillController = {
  async getAll(req, res) {
    const char = await CharacterModel.findById(req.params.id);
    if (!char) return res.status(404).json({ message: 'Персонажа не знайдено' });
    const isOwner = char.user_id === req.user.sub;
    const isGM = req.user.role === 'game_master';
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isGM && !isAdmin && !char.is_public && !await isCampaignGmForCharacter(char.id, req.user.sub)) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    const skills = await SkillModel.findAll(req.params.id);
    res.json({ skills });
  },

  async patch(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const { value, progress_marks } = req.body;
    const skill = await SkillModel.patch(req.params.id, req.params.key, { value, progress_marks });
    if (!skill) return res.status(404).json({ message: 'Навичку не знайдено' });
    res.json({ skill });
  },

  // Bulk update for initial distribution or mass edit
  async bulkUpdate(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const { updates } = req.body; // [{skill_key, value, progress_marks}]
    if (!Array.isArray(updates)) return res.status(400).json({ message: 'updates повинен бути масивом' });
    const skills = await SkillModel.bulkUpdate(req.params.id, updates);
    res.json({ skills });
  },
};

module.exports = SkillController;
