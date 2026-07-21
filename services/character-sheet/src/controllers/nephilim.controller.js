const CharacterModel = require('../models/character.model');
const NephilimBreakthroughModel = require('../models/nephilim-breakthrough.model');
const { calcAllowedBreakthroughs } = require('../rules/nephilim.rules');
const authorizeCharacterWrite = require('./authorize-character-write');
const { isCampaignGmForCharacter } = require('../models/campaign-access.model');

const NephilimController = {
  async list(req, res) {
    const char = await CharacterModel.findById(req.params.id);
    if (!char) return res.status(404).json({ message: 'Персонажа не знайдено' });
    const isOwner = char.user_id === req.user.sub;
    const isGM    = req.user.role === 'game_master';
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isGM && !isAdmin && !char.is_public && !await isCampaignGmForCharacter(char.id, req.user.sub)) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }
    const breakthroughs = await NephilimBreakthroughModel.findAll(req.params.id);
    res.json({ breakthroughs });
  },

  async use(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;

    const unlockedCount = await NephilimBreakthroughModel.countUnlocked(req.params.id);
    const usedBreakthroughs = await NephilimBreakthroughModel.findAll(req.params.id);
    const totalAllowed = calcAllowedBreakthroughs(unlockedCount);

    if (usedBreakthroughs.length >= totalAllowed) {
      return res.status(400).json({ message: 'Немає доступних проривів' });
    }

    const nodeId = await NephilimBreakthroughModel.use(req.params.id, req.params.nodeId);
    if (!nodeId) return res.status(200).json({ message: 'Прорив вже використано для цього вузла' });
    res.status(201).json({ node_id: nodeId });
  },

  async revoke(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;

    const deleted = await NephilimBreakthroughModel.revoke(req.params.id, req.params.nodeId);
    if (!deleted) return res.status(404).json({ message: 'Прорив не знайдено' });
    res.json({ message: 'Прорив скасовано' });
  },
};

module.exports = NephilimController;
