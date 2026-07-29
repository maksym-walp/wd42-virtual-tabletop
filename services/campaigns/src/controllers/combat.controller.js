const CombatSceneModel = require('../models/combat-scene.model');
const CombatantModel = require('../models/combatant.model');
const CampaignModel = require('../models/campaign.model');
const CampaignCharacterModel = require('../models/campaign-character.model');
const { loadCampaignOr404, isGm } = require('./load-campaign');

const HIDDEN_COMBATANT_FIELDS = ['id', 'name', 'description', 'is_hidden'];

// Прихований від гравців комбатант (is_hidden) віддає лише картку-заглушку:
// жодних чисел здоров'я/захисту/ініціативи чи нотаток GM, доки його не розкрито.
function redactForPlayers(combatant) {
  if (!combatant.is_hidden) return combatant;
  const redacted = {};
  for (const key of HIDDEN_COMBATANT_FIELDS) redacted[key] = combatant[key];
  return redacted;
}

const CombatController = {
  async getCurrent(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;

    const gm = isGm(campaign, req.user.sub);
    const member = gm || await CampaignCharacterModel.isMember(campaign.id, req.user.sub);
    if (!member) return res.status(403).json({ message: 'Доступ заборонено' });

    const scene = await CombatSceneModel.findCurrentByCampaign(campaign.id);
    if (!scene) return res.json({ scene: null, combatants: [] });

    const combatants = await CombatantModel.listByScene(scene.id);
    const visible = gm ? combatants : combatants.map(redactForPlayers);
    res.json({ scene, combatants: visible });
  },

  async createScene(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!isGm(campaign, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    const scene = await CombatSceneModel.create(campaign.id, { image_url: req.body.image_url });
    res.status(201).json({ scene });
  },

  async updateScene(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!isGm(campaign, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { image_url, round_number } = req.body;
    const scene = await CombatSceneModel.update(req.params.sceneId, campaign.id, { image_url, round_number });
    if (!scene) return res.status(404).json({ message: 'Сцену не знайдено' });
    res.json({ scene });
  },

  async removeScene(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!isGm(campaign, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    const removed = await CombatSceneModel.remove(req.params.sceneId, campaign.id);
    if (!removed) return res.status(404).json({ message: 'Сцену не знайдено' });
    res.status(204).send();
  },

  async addCombatant(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!isGm(campaign, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    const scene = await CombatSceneModel.findById(req.params.sceneId, campaign.id);
    if (!scene) return res.status(404).json({ message: 'Сцену не знайдено' });

    const { character_id, name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    if (character_id) {
      const character = await CampaignModel.findCharacterOwner(character_id);
      if (!character) return res.status(404).json({ message: 'Персонажа не знайдено' });
    }

    const combatant = await CombatantModel.add(scene.id, { ...req.body, name: name.trim() });
    res.status(201).json({ combatant });
  },

  async updateCombatant(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!isGm(campaign, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    const combatant = await CombatantModel.update(req.params.combatantId, campaign.id, req.body);
    if (!combatant) return res.status(404).json({ message: 'Комбатанта не знайдено' });
    res.json({ combatant });
  },

  async removeCombatant(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!isGm(campaign, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    const removed = await CombatantModel.remove(req.params.combatantId, campaign.id);
    if (!removed) return res.status(404).json({ message: 'Комбатанта не знайдено' });
    res.status(204).send();
  },

  // Наступний хід: серед тих, хто ще не діяв цього раунду, обирає найвищу
  // ініціативу і позначає, що він походив.
  async nextTurn(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!isGm(campaign, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    const scene = await CombatSceneModel.findCurrentByCampaign(campaign.id);
    if (!scene) return res.status(404).json({ message: 'Активної бойової сцени не знайдено' });

    const next = await CombatantModel.findNextToAct(scene.id);
    if (!next) return res.status(404).json({ message: 'Усі комбатанти вже походили цього раунду' });

    const combatant = await CombatantModel.markActed(next.id);
    res.json({ combatant });
  },

  async nextRound(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!isGm(campaign, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    const scene = await CombatSceneModel.findCurrentByCampaign(campaign.id);
    if (!scene) return res.status(404).json({ message: 'Активної бойової сцени не знайдено' });

    const updated = await CombatSceneModel.advanceRound(scene.id, campaign.id);
    res.json({ scene: updated });
  },
};

module.exports = CombatController;
