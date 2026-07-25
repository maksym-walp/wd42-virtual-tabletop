const CampaignMapModel = require('../models/campaign-map.model');
const CampaignCharacterModel = require('../models/campaign-character.model');
const { loadCampaignOr404, isGm } = require('./load-campaign');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CampaignMapController = {
  // Map cards visible to any campaign member (GM or player).
  async list(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;

    const member = isGm(campaign, req.user.sub)
      || await CampaignCharacterModel.isMember(campaign.id, req.user.sub);
    if (!member) return res.status(403).json({ message: 'Доступ заборонено' });

    const cards = await CampaignMapModel.listByCampaign(campaign.id, req.user.sub, req.user.role === 'admin');
    res.json({ maps: cards });
  },

  async add(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!isGm(campaign, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { map_id } = req.body;
    if (!map_id || !UUID_RE.test(map_id)) return res.status(400).json({ message: 'Некоректний map_id' });
    if (!await CampaignMapModel.mapExists(map_id)) return res.status(404).json({ message: 'Мапу не знайдено' });

    const card = await CampaignMapModel.add(campaign.id, map_id, req.user.sub);
    if (!card) return res.status(409).json({ message: 'Мапу вже додано до кампанії' });
    res.status(201).json({ card });
  },

  async remove(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!isGm(campaign, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    const removed = await CampaignMapModel.remove(req.params.cardId, campaign.id);
    if (!removed) return res.status(404).json({ message: 'Картку не знайдено' });
    res.status(204).send();
  },
};

module.exports = CampaignMapController;
