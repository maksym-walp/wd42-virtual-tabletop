const CampaignModel = require('../models/campaign.model');
const CampaignCharacterModel = require('../models/campaign-character.model');
const CharacterSheetClient = require('../clients/character-sheet.client');
const bus = require('../realtime/bus');
const { canManage } = require('./load-campaign');

// Скільки годин майстер додає одним натисканням на Ширмі.
const TIMER_STEPS = [1, 4, 8, 12];

// Хто отримав рівні Втоми — для сповіщення майстра.
function fatigueNotifications(results) {
  return (results || [])
    .filter((r) => !r.skipped && r.fatigue_after > r.fatigue_before)
    .map((r) => ({
      character_id: r.character_id,
      name: r.name,
      fatigue_before: r.fatigue_before,
      fatigue_after: r.fatigue_after,
      checks: r.checks,
    }));
}

const TimerController = {
  // POST /:id/timer/advance { hours } — GM-only. Правила (перевірки
  // Витривалості, Втома) застосовує character-sheet; ми лише передаємо
  // персонажів кампанії й розсилаємо 'characters'.
  async advance(req, res) {
    const campaign = await CampaignModel.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Кампанію не знайдено' });
    if (!canManage(campaign, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const hours = Number(req.body.hours);
    if (!TIMER_STEPS.includes(hours)) {
      return res.status(400).json({ message: `hours має бути одним із: ${TIMER_STEPS.join(', ')}` });
    }

    const characterIds = await CampaignCharacterModel.listCharacterIds(campaign.id);
    if (!characterIds.length) return res.json({ results: [], notifications: [] });

    const { results } = await CharacterSheetClient.advanceTimer(req.headers?.authorization, { characterIds, hours });
    bus.publish(campaign.id, 'characters');
    res.json({ results, notifications: fatigueNotifications(results) });
  },
};

module.exports = TimerController;
module.exports.fatigueNotifications = fatigueNotifications;
module.exports.TIMER_STEPS = TIMER_STEPS;
