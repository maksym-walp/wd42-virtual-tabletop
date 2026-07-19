const CampaignModel = require('../models/campaign.model');

/**
 * Завантажує кампанію або сам відповідає 404 і повертає null.
 * Виклик: `const campaign = await loadCampaignOr404(req, res); if (!campaign) return;`
 */
async function loadCampaignOr404(req, res) {
  const campaign = await CampaignModel.findById(req.params.id);
  if (!campaign) { res.status(404).json({ message: 'Кампанію не знайдено' }); return null; }
  return campaign;
}

function isGm(campaign, userId) {
  return campaign.gm_id === userId;
}

module.exports = { loadCampaignOr404, isGm };
