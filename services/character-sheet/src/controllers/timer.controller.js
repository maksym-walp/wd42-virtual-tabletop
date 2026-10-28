const CharacterStateModel = require('../models/character-state.model');
const { isCampaignGmForCharacter } = require('../models/campaign-access.model');
const { advanceTimer, timerView } = require('../rules/timer');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CHARACTERS = 50;
const MAX_HOURS = 1000;

const TimerController = {
  // POST /timer/advance { character_ids, hours, source_key? } — лише ГМ
  // кампанії кожного з персонажів або адмін (власник — ні). source_key
  // (напр. combat:<sceneId>) робить нарахування ідемпотентним.
  async advance(req, res) {
    const { character_ids: rawIds, hours: rawHours, source_key: sourceKey } = req.body;
    if (!Array.isArray(rawIds) || !rawIds.length || rawIds.length > MAX_CHARACTERS || !rawIds.every((id) => UUID_RE.test(id))) {
      return res.status(400).json({ message: `character_ids — непорожній масив UUID (до ${MAX_CHARACTERS})` });
    }
    const hours = Number(rawHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_HOURS) {
      return res.status(400).json({ message: `hours — додатне число до ${MAX_HOURS}` });
    }
    if (sourceKey != null && (typeof sourceKey !== 'string' || !sourceKey.trim() || sourceKey.length > 100)) {
      return res.status(400).json({ message: 'source_key — непорожній рядок до 100 символів' });
    }

    const ids = [...new Set(rawIds)];
    if (req.user.role !== 'admin') {
      for (const id of ids) {
        if (!await isCampaignGmForCharacter(id, req.user.sub)) {
          return res.status(403).json({ message: 'Таймер діяльності змінює лише ГМ кампанії персонажа' });
        }
      }
    }

    const results = [];
    for (const id of ids) {
      const out = await CharacterStateModel.withCharacterLock(id, async (client, state) => {
        const base = { character_id: id, name: state.character.name };
        if (sourceKey && !await CharacterStateModel.insertTimerEvent(client, id, sourceKey, hours)) {
          return { ...base, skipped: true, reason: 'already_applied', timer: timerView(state.character) };
        }
        const t = advanceTimer(state, hours);
        const character = await CharacterStateModel.saveState(client, id, {
          conditions: t.conditions,
          death_scale: t.death_scale,
          rest_timer_hours: t.rest_timer_hours,
          timer_checks_done: t.timer_checks_done,
          timer_checks_passed: t.timer_checks_passed,
        });
        return {
          ...base,
          skipped: false,
          hours_added: t.hours_added,
          timer_speed: t.timer_speed,
          checks: t.checks,
          fatigue_before: t.fatigue_before,
          fatigue_after: t.fatigue_after,
          death_scale: character.death_scale,
          timer: timerView(character),
        };
      });
      results.push(out ?? { character_id: id, skipped: true, reason: 'not_found' });
    }
    res.json({ results });
  },
};

module.exports = TimerController;
