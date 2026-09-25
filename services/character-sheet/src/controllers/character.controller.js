const CharacterModel = require('../models/character.model');
const SkillModel = require('../models/skill.model');
const SpellProgressModel = require('../models/spell.model');
const TreeProgressModel = require('../models/tree-progress.model');
const EquipmentModel = require('../models/equipment.model');
const AbilityModel = require('../models/ability.model');
const RitualTrackerModel = require('../models/ritual-tracker.model');
const authorizeCharacterWrite = require('./authorize-character-write');
const { isCampaignGmForCharacter } = require('../models/campaign-access.model');

const CharacterController = {
  async list(req, res) {
    const characters = await CharacterModel.findAllByUser(req.user.sub, req.user.role === 'admin');
    res.json({ characters });
  },

  async listCommunity(req, res) {
    const limit = Number(req.query.limit) || 15;
    const characters = await CharacterModel.findAllPublic(req.user.sub, { limit });
    res.json({ characters });
  },

  async create(req, res) {
    const { name, archetype, race, skills } = req.body;
    if (!name || !archetype || !race) {
      return res.status(400).json({ message: 'name, archetype та race є обовʼязковими' });
    }
    const character = await CharacterModel.create(req.user.sub, { name, archetype, race, skills });
    res.status(201).json({ character });
  },

  // Full sheet: character + skills + spells + tree + equipment
  async getSheet(req, res) {
    const char = await CharacterModel.findById(req.params.id);
    if (!char) return res.status(404).json({ message: 'Персонажа не знайдено' });

    const isOwner = char.user_id === req.user.sub;
    const isGM = req.user.role === 'game_master';
    const isAdmin = req.user.role === 'admin';
    const isCampaignGm = !isOwner && await isCampaignGmForCharacter(char.id, req.user.sub);
    if (!isOwner && !isGM && !isAdmin && !isCampaignGm && !char.is_public) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    // Distinct from is_owner below: true only when this viewer's write
    // access comes from campaign-GM/admin authority rather than literal
    // ownership. Drives the GM-only skill/experience editing UI on the
    // frontend (direct value entry, budget controls) as opposed to the
    // player's circle-stepper + spend-to-level flow.
    const isGmViewer = !isOwner && (isCampaignGm || isAdmin);

    const [skills, spells, tree, equipment, abilities, rituals, owner_username, experience] = await Promise.all([
      SkillModel.findAll(char.id),
      SpellProgressModel.findAll(char.id),
      TreeProgressModel.findAll(char.id),
      EquipmentModel.findAll(char.id),
      AbilityModel.findAll(char.id),
      RitualTrackerModel.findAll(char.id),
      CharacterModel.findOwnerUsername(char.user_id),
      CharacterModel.experienceSummary(char.id),
    ]);

    // is_owner drives all edit UI on the frontend — a campaign GM or an admin
    // has the same write rights as the owner (see authorizeCharacterWrite),
    // so they get the same flag here rather than a separate "read-only" view.
    res.json({
      character: { ...char, owner_username },
      skills, spells, tree, equipment, abilities, rituals, experience,
      is_owner: isOwner || isCampaignGm || isAdmin,
      is_gm: isGmViewer,
    });
  },

  async getPublicSheet(req, res) {
    const char = await CharacterModel.findPublicById(req.params.id);
    if (!char) return res.status(404).json({ message: 'Персонажа не знайдено або він приватний' });

    const [skills, spells, tree, equipment, abilities, rituals, owner_username, experience] = await Promise.all([
      SkillModel.findAll(char.id),
      SpellProgressModel.findAll(char.id),
      TreeProgressModel.findAll(char.id),
      EquipmentModel.findAll(char.id),
      AbilityModel.findAll(char.id),
      RitualTrackerModel.findAll(char.id),
      CharacterModel.findOwnerUsername(char.user_id),
      CharacterModel.experienceSummary(char.id),
    ]);

    res.json({ character: { ...char, owner_username }, skills, spells, tree, equipment, abilities, rituals, experience, is_owner: false, is_gm: false });
  },

  async update(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;

    const updated = await CharacterModel.update(req.params.id, req.body);
    res.json({ character: updated });
  },

  async remove(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;

    const deleted = await CharacterModel.delete(req.params.id, req.user.sub);
    if (!deleted) return res.status(404).json({ message: 'Персонажа не знайдено' });
    res.json({ message: 'Видалено' });
  },

  // Admin-only (route-gated) — reassigns the character to another user.
  async setOwner(req, res) {
    const { owner_username } = req.body;
    if (!owner_username) return res.status(400).json({ message: 'owner_username є обовʼязковим' });

    const character = await CharacterModel.setOwner(req.params.id, owner_username);
    if (!character) return res.status(404).json({ message: 'Персонажа не знайдено або користувача з таким іменем не існує' });
    res.json({ character });
  },

  // Owner/campaign-GM/admin — duplicates the character, optionally with a new
  // race/archetype (see CharacterModel.duplicate for what carries over).
  async duplicate(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;

    const { name, archetype, race } = req.body;
    const character = await CharacterModel.duplicate(req.params.id, { name, archetype, race });
    if (!character) return res.status(404).json({ message: 'Персонажа не знайдено' });
    res.status(201).json({ character });
  },
};

module.exports = CharacterController;
