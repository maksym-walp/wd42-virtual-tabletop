const CampaignModel = require('../models/campaign.model');
const CampaignCharacterModel = require('../models/campaign-character.model');
const { loadCampaignOr404, isGm } = require('./load-campaign');

const CampaignController = {
  async create(req, res) {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const campaign = await CampaignModel.create(req.user.sub, name);
    res.status(201).json({ campaign });
  },

  async listMine(req, res) {
    const campaigns = await CampaignModel.findAllForUser(req.user.sub);
    // gm_notes are GM-only — strip them from campaigns the user isn't GM of
    const visible = campaigns.map(({ gm_notes, ...rest }) => (rest.is_gm ? { ...rest, gm_notes } : rest));
    res.json({ campaigns: visible });
  },

  async getOne(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;

    const gm = isGm(campaign, req.user.sub);
    const member = gm || await CampaignCharacterModel.isMember(campaign.id, req.user.sub);
    if (!member) return res.status(403).json({ message: 'Доступ заборонено' });

    if (gm) return res.json({ campaign: { ...campaign, is_gm: true } });
    const { gm_notes, ...visible } = campaign;
    res.json({ campaign: { ...visible, is_gm: false } });
  },

  async updateSharedNotes(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!isGm(campaign, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    const updated = await CampaignModel.updateSharedNotes(campaign.id, req.body.shared_notes ?? '');
    res.json({ campaign: updated });
  },

  async updateGmNotes(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!isGm(campaign, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    const updated = await CampaignModel.updateGmNotes(campaign.id, req.body.gm_notes ?? '');
    res.json({ campaign: updated });
  },

  async rename(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!isGm(campaign, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    const updated = await CampaignModel.rename(campaign.id, name.trim());
    res.json({ campaign: updated });
  },

  async remove(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!isGm(campaign, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    await CampaignModel.remove(campaign.id);
    res.status(204).send();
  },
};

module.exports = CampaignController;
