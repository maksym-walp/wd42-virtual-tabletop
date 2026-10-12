const CharacterModel = require('../models/character.model');
const SkillModel = require('../models/skill.model');
const SpellProgressModel = require('../models/spell.model');
const TreeProgressModel = require('../models/tree-progress.model');
const EquipmentModel = require('../models/equipment.model');
const AbilityModel = require('../models/ability.model');
const RitualTrackerModel = require('../models/ritual-tracker.model');
const authorizeCharacterWrite = require('./authorize-character-write');
const { isCampaignGmForCharacter } = require('../models/campaign-access.model');
const { treeSpellAccess } = require('../models/spell-access.model');
const SiteConfigModel = require('../models/site-config.model');

const CharacterController = {
  async list(req, res) {
    const characters = await CharacterModel.findAllByUser(req.user.sub, req.user.role === 'admin', {
      includeGmCampaigns: req.query.include === 'campaigns',
    });
    res.json({ characters });
  },

  async listCommunity(req, res) {
    const limit = Number(req.query.limit) || 15;
    const characters = await CharacterModel.findAllPublic(req.user.sub, { limit });
    res.json({ characters });
  },

  async create(req, res) {
    const { name, archetype, race_id: raceId, skills, people_id: peopleId } = req.body;
    if (!name || !archetype || !raceId) {
      return res.status(400).json({ message: 'name, archetype та race_id є обовʼязковими' });
    }
    if (!await SiteConfigModel.isCharacterRace(raceId)) {
      return res.status(400).json({ message: 'Ця раса недоступна для персонажів' });
    }
    let peopleBonus = {};
    if (peopleId) {
      const people = await SiteConfigModel.findCharacterPeople(raceId, peopleId);
      if (!people) return res.status(400).json({ message: 'Цей підвид недоступний для обраної раси' });
      peopleBonus = people.bonus;
    }
    const character = await CharacterModel.create(req.user.sub, {
      name, archetype, raceId, skills, peopleId: peopleId || null, peopleBonus,
    });
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
    // ownership. Drives the GM-only skill editing UI on the
    // frontend (direct value entry) as opposed to the player's skill
    // edit menu.
    const isGmViewer = !isOwner && (isCampaignGm || isAdmin);

    const [skills, spells, tree, equipment, abilities, rituals, owner_username, spellAccess] = await Promise.all([
      SkillModel.findAll(char.id),
      SpellProgressModel.findAll(char.id),
      TreeProgressModel.findAll(char.id),
      EquipmentModel.findAll(char.id),
      AbilityModel.findAll(char.id),
      RitualTrackerModel.findAll(char.id),
      CharacterModel.findOwnerUsername(char.user_id),
      treeSpellAccess(char.id),
    ]);

    // is_owner drives all edit UI on the frontend — a campaign GM or an admin
    // has the same write rights as the owner (see authorizeCharacterWrite),
    // so they get the same flag here rather than a separate "read-only" view.
    res.json({
      character: { ...char, owner_username },
      skills, spells, tree, equipment, abilities, rituals,
      // Що дерево відкрило для заклинань: { traditions, max_complexity }.
      spell_access: { traditions: spellAccess.traditions, max_complexity: spellAccess.maxComplexity },
      is_owner: isOwner || isCampaignGm || isAdmin,
      is_gm: isGmViewer,
      // Може давати заклинання поза правилами доступності (див. isSpellMaster).
      is_spell_master: isGM || isAdmin || isCampaignGm,
    });
  },

  async getPublicSheet(req, res) {
    const char = await CharacterModel.findPublicById(req.params.id);
    if (!char) return res.status(404).json({ message: 'Персонажа не знайдено або він приватний' });

    const [skills, spells, tree, equipment, abilities, rituals, owner_username, spellAccess] = await Promise.all([
      SkillModel.findAll(char.id),
      SpellProgressModel.findAll(char.id),
      TreeProgressModel.findAll(char.id),
      EquipmentModel.findAll(char.id),
      AbilityModel.findAll(char.id),
      RitualTrackerModel.findAll(char.id),
      CharacterModel.findOwnerUsername(char.user_id),
      treeSpellAccess(char.id),
    ]);

    res.json({
      character: { ...char, owner_username }, skills, spells, tree, equipment, abilities, rituals,
      spell_access: { traditions: spellAccess.traditions, max_complexity: spellAccess.maxComplexity },
      is_owner: false, is_gm: false, is_spell_master: false,
    });
  },

  async update(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;

    const updated = await CharacterModel.update(req.params.id, req.body);
    res.json({ character: updated });
  },

  // Вибір/зняття підвиду (народу) — body { people_id: uuid | null }. Підвид
  // має бути відкритий адміном для раси цього персонажа; його бонуси до
  // навичок застосовуються дельтою (див. CharacterModel.setPeople).
  async setPeople(req, res) {
    const char = await authorizeCharacterWrite(req, res);
    if (!char) return;

    const peopleId = req.body.people_id || null;
    let bonus = {};
    if (peopleId) {
      const people = await SiteConfigModel.findCharacterPeople(char.race_id, peopleId);
      if (!people) return res.status(400).json({ message: 'Цей підвид недоступний для раси персонажа' });
      bonus = people.bonus;
    }
    const result = await CharacterModel.setPeople(req.params.id, peopleId, bonus);
    if (!result) return res.status(404).json({ message: 'Персонажа не знайдено' });
    res.json(result);
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

    const { name, archetype, race_id: raceId } = req.body;
    if (raceId && !await SiteConfigModel.isCharacterRace(raceId)) {
      return res.status(400).json({ message: 'Ця раса недоступна для персонажів' });
    }
    const character = await CharacterModel.duplicate(req.params.id, { name, archetype, raceId });
    if (!character) return res.status(404).json({ message: 'Персонажа не знайдено' });
    res.status(201).json({ character });
  },
};

module.exports = CharacterController;
