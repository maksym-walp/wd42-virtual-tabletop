const CampaignSessionModel = require('../models/campaign-session.model');
const bus = require('../realtime/bus');
const { loadCampaignOr404, canManage, canView } = require('./load-campaign');

const CampaignSessionController = {
  // Session recaps visible to any campaign member.
  async list(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;

    if (!await canView(campaign, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const sessions = await CampaignSessionModel.listByCampaign(campaign.id);
    res.json({ sessions });
  },

  async add(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!canManage(campaign, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { title, content, session_date } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ message: 'title є обовʼязковим' });

    const session = await CampaignSessionModel.add(campaign.id, { title: title.trim(), content, session_date });
    bus.publish(campaign.id, 'sessions');
    res.status(201).json({ session });
  },

  async update(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!canManage(campaign, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { title, content, session_date } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ message: 'title є обовʼязковим' });

    const session = await CampaignSessionModel.update(req.params.sessionId, campaign.id, {
      title: title.trim(), content, session_date,
    });
    if (!session) return res.status(404).json({ message: 'Сесію не знайдено' });
    bus.publish(campaign.id, 'sessions');
    res.json({ session });
  },

  async remove(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!canManage(campaign, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const removed = await CampaignSessionModel.remove(req.params.sessionId, campaign.id);
    if (!removed) return res.status(404).json({ message: 'Сесію не знайдено' });
    bus.publish(campaign.id, 'sessions');
    res.status(204).send();
  },
};

module.exports = CampaignSessionController;
