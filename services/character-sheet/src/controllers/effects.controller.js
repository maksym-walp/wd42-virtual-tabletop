const CharacterStateModel = require('../models/character-state.model');
const { sheetDerived } = require('../rules');
const { heroicTotal } = require('../rules/stats');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 50;

const EffectsController = {
  // GET /effects?ids=a,b — ефекти станів для трекера бою. Повертає лише
  // персонажів, яких користувач може бачити (власник, ГМ, учасник тієї ж
  // кампанії, адмін); решта id мовчки пропускаються.
  async list(req, res) {
    const ids = [...new Set(String(req.query.ids || '').split(',').map((s) => s.trim()).filter((s) => UUID_RE.test(s)))]
      .slice(0, MAX_IDS);
    if (!ids.length) return res.json({ characters: {} });

    const characters = await CharacterStateModel.findVisible(ids, req.user.sub, req.user.role === 'admin');
    if (!characters.length) return res.json({ characters: {} });
    const skills = await CharacterStateModel.findSkills(characters.map((c) => c.id));

    const result = {};
    for (const character of characters) {
      const own = skills.filter((s) => s.character_id === character.id);
      result[character.id] = {
        ...sheetDerived(character, own),
        conditions: character.conditions || [],
        heroic_left: Math.max(0, heroicTotal(own) - (Number(character.heroic_actions_used) || 0)),
      };
    }
    res.json({ characters: result });
  },
};

module.exports = EffectsController;
