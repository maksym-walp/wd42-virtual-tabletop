const CampaignModel = require('../models/campaign.model');
const bus = require('../realtime/bus');
const { loadCampaignOr404, canManage, canView, accessOf, isAdmin } = require('./load-campaign');

// gm_notes — лише для майстра/адміна; is_gm означає «має майстерські права».
function present(campaign, user) {
  const access = accessOf(campaign, user);
  if (access !== 'player') return { ...campaign, is_gm: true, access };
  const { gm_notes, ...visible } = campaign;
  return { ...visible, is_gm: false, access };
}

async function loadManagedOr403(req, res) {
  const campaign = await loadCampaignOr404(req, res);
  if (!campaign) return null;
  if (!canManage(campaign, req.user)) { res.status(403).json({ message: 'Доступ заборонено' }); return null; }
  return campaign;
}

const CampaignController = {
  async create(req, res) {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const campaign = await CampaignModel.create(req.user.sub, name);
    res.status(201).json({ campaign });
  },

  // ?scope=all — адмін бачить усі кампанії, не лише ті, де він учасник.
  async listMine(req, res) {
    const campaigns = req.query?.scope === 'all' && isAdmin(req.user)
      ? await CampaignModel.findAll()
      : await CampaignModel.findAllForUser(req.user.sub);
    res.json({ campaigns: campaigns.map((c) => present(c, req.user)) });
  },

  async getOne(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!await canView(campaign, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    res.json({ campaign: present(campaign, req.user) });
  },

  async updateDescription(req, res) {
    const campaign = await loadManagedOr403(req, res);
    if (!campaign) return;

    const updated = await CampaignModel.updateDescription(campaign.id, req.body.description ?? '');
    bus.publish(campaign.id, 'campaign');
    res.json({ campaign: updated });
  },

  async updateGmNotes(req, res) {
    const campaign = await loadManagedOr403(req, res);
    if (!campaign) return;

    const updated = await CampaignModel.updateGmNotes(campaign.id, req.body.gm_notes ?? '');
    res.json({ campaign: updated });
  },

  async updateCurrentDate(req, res) {
    const campaign = await loadManagedOr403(req, res);
    if (!campaign) return;

    const { calendar_id, current_year, current_month_id, current_day } = req.body;
    const updated = await CampaignModel.updateCurrentDate(campaign.id, {
      calendar_id, current_year, current_month_id, current_day,
    });
    bus.publish(campaign.id, 'campaign');
    res.json({ campaign: updated });
  },

  async rename(req, res) {
    const campaign = await loadManagedOr403(req, res);
    if (!campaign) return;

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    const updated = await CampaignModel.rename(campaign.id, name.trim());
    bus.publish(campaign.id, 'campaign');
    res.json({ campaign: updated });
  },

  async regenerateInviteCode(req, res) {
    const campaign = await loadManagedOr403(req, res);
    if (!campaign) return;

    const updated = await CampaignModel.regenerateInviteCode(campaign.id);
    res.json({ campaign: updated });
  },

  async remove(req, res) {
    const campaign = await loadManagedOr403(req, res);
    if (!campaign) return;

    await CampaignModel.remove(campaign.id);
    bus.publish(campaign.id, 'campaign');
    res.status(204).send();
  },
};

module.exports = CampaignController;
