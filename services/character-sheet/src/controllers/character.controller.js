const CharacterModel = require('../models/character.model');
const SkillModel = require('../models/skill.model');
const SpellProgressModel = require('../models/spell.model');
const TreeProgressModel = require('../models/tree-progress.model');
const NephilimBreakthroughModel = require('../models/nephilim-breakthrough.model');
const EquipmentModel = require('../models/equipment.model');
const ManeuverModel = require('../models/maneuver.model');
const AbilityModel = require('../models/ability.model');
const RitualTrackerModel = require('../models/ritual-tracker.model');
const authorizeCharacterWrite = require('./authorize-character-write');
const { isCampaignGmForCharacter } = require('../models/campaign-access.model');

const CharacterController = {
  async list(req, res) {
    const characters = await CharacterModel.findAllByUser(req.user.sub);
    res.json({ characters });
  },

  async create(req, res) {
    const { name, archetype, race, race_ancestry, skills } = req.body;
    if (!name || !archetype || !race) {
      return res.status(400).json({ message: 'name, archetype та race є обовʼязковими' });
    }
    const character = await CharacterModel.create(req.user.sub, { name, archetype, race, race_ancestry, skills });
    res.status(201).json({ character });
  },

  // Full sheet: character + skills + spells + tree + equipment
  async getSheet(req, res) {
    const char = await CharacterModel.findById(req.params.id);
    if (!char) return res.status(404).json({ message: 'Персонажа не знайдено' });

    const isOwner = char.user_id === req.user.sub;
    const isGM = req.user.role === 'game_master';
    const isCampaignGm = !isOwner && await isCampaignGmForCharacter(char.id, req.user.sub);
    if (!isOwner && !isGM && !isCampaignGm && !char.is_public) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    const [skills, spells, tree, equipment, nephilim_breakthroughs, maneuvers, abilities, rituals, owner_username] = await Promise.all([
      SkillModel.findAll(char.id),
      SpellProgressModel.findAll(char.id),
      TreeProgressModel.findAll(char.id),
      EquipmentModel.findAll(char.id),
      NephilimBreakthroughModel.findAll(char.id),
      ManeuverModel.findAll(char.id),
      AbilityModel.findAll(char.id),
      RitualTrackerModel.findAll(char.id),
      CharacterModel.findOwnerUsername(char.user_id),
    ]);

    // is_owner drives all edit UI on the frontend — a campaign GM has the
    // same write rights as the owner (see authorizeCharacterWrite), so they
    // get the same flag here rather than a separate "read-only" GM view.
    res.json({
      character: { ...char, owner_username },
      skills, spells, tree, equipment, nephilim_breakthroughs, maneuvers, abilities, rituals,
      is_owner: isOwner || isCampaignGm,
    });
  },

  async getPublicSheet(req, res) {
    const char = await CharacterModel.findPublicById(req.params.id);
    if (!char) return res.status(404).json({ message: 'Персонажа не знайдено або він приватний' });

    const [skills, spells, equipment, maneuvers, abilities, rituals, owner_username] = await Promise.all([
      SkillModel.findAll(char.id),
      SpellProgressModel.findAll(char.id),
      EquipmentModel.findAll(char.id),
      ManeuverModel.findAll(char.id),
      AbilityModel.findAll(char.id),
      RitualTrackerModel.findAll(char.id),
      CharacterModel.findOwnerUsername(char.user_id),
    ]);

    res.json({ character: { ...char, owner_username }, skills, spells, equipment, maneuvers, abilities, rituals, is_owner: false });
  },

  async update(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;

    const updated = await CharacterModel.update(req.params.id, req.body);
    res.json({ character: updated });
  },

  async remove(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;

    const deleted = await CharacterModel.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Персонажа не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = CharacterController;
