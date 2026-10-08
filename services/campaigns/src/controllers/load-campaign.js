const CampaignModel = require('../models/campaign.model');
const CampaignCharacterModel = require('../models/campaign-character.model');

/**
 * Завантажує кампанію або сам відповідає 404 і повертає null.
 * Виклик: `const campaign = await loadCampaignOr404(req, res); if (!campaign) return;`
 */
async function loadCampaignOr404(req, res) {
  const campaign = await CampaignModel.findById(req.params.id);
  if (!campaign) { res.status(404).json({ message: 'Кампанію не знайдено' }); return null; }
  return campaign;
}

function isAdmin(user) {
  return user?.role === 'admin';
}

// Майстерські права: власний майстер кампанії або адмін (у будь-якій кампанії).
function canManage(campaign, user) {
  return campaign.gm_id === user.sub || isAdmin(user);
}

// Читання кампанії: майстер/адмін або власник прикріпленого персонажа.
async function canView(campaign, user) {
  return canManage(campaign, user) || CampaignCharacterModel.isMember(campaign.id, user.sub);
}

// Роль глядача для бейджа на фронті.
function accessOf(campaign, user) {
  if (campaign.gm_id === user.sub) return 'gm';
  if (isAdmin(user)) return 'admin';
  return 'player';
}

module.exports = { loadCampaignOr404, canManage, canView, accessOf, isAdmin };
