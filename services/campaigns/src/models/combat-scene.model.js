const pool = require('../config/db');

// Auth is resolved in the controller, same convention as the other
// campaign-scoped models (campaign-gallery.model.js, campaign-map.model.js).
const CombatSceneModel = {
  async create(campaignId, { image_url } = {}) {
    const { rows } = await pool.query(
      `INSERT INTO campaigns.combat_scenes (campaign_id, image_url)
       VALUES ($1, $2)
       RETURNING *`,
      [campaignId, image_url ?? null]
    );
    return rows[0];
  },

  // "Поточна" сцена — найновіша створена для кампанії. Старі сцени
  // лишаються рядками в таблиці (історія), просто більше не показуються.
  async findCurrentByCampaign(campaignId) {
    const { rows } = await pool.query(
      `SELECT * FROM campaigns.combat_scenes
       WHERE campaign_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [campaignId]
    );
    return rows[0] || null;
  },

  async findById(id, campaignId) {
    const { rows } = await pool.query(
      `SELECT * FROM campaigns.combat_scenes WHERE id = $1 AND campaign_id = $2`,
      [id, campaignId]
    );
    return rows[0] || null;
  },

  // Partial update: omitted (undefined) fields keep their current value via
  // COALESCE — same convention as character_sheet's character.model.js update.
  async update(id, campaignId, { image_url, round_number } = {}) {
    const { rows } = await pool.query(
      `UPDATE campaigns.combat_scenes
       SET image_url    = COALESCE($3, image_url),
           round_number = COALESCE($4, round_number),
           updated_at   = NOW()
       WHERE id = $1 AND campaign_id = $2
       RETURNING *`,
      [id, campaignId, image_url ?? null, round_number ?? null]
    );
    return rows[0] || null;
  },

  // Advances the round counter and resets every combatant's turn flag —
  // this is what POST /next-round drives.
  async advanceRound(id, campaignId) {
    const { rows } = await pool.query(
      `UPDATE campaigns.combat_scenes
       SET round_number = round_number + 1, updated_at = NOW()
       WHERE id = $1 AND campaign_id = $2
       RETURNING *`,
      [id, campaignId]
    );
    const scene = rows[0] || null;
    if (scene) {
      // Новий раунд — усім по три дії знову, а журнал повторень (4.10)
      // порожній. Активний захист і залишена реакція живуть до початку
      // власного ходу комбатанта (4.5.1), тож тут їх не чіпаємо.
      await pool.query(
        `UPDATE campaigns.combatants
         SET has_acted_this_round = false, actions_used = 0, actions_log = '{}', updated_at = NOW()
         WHERE combat_scene_id = $1`,
        [id]
      );
    }
    return scene;
  },

  // Позначає бій завершеним (ended_at). Повторне завершення нічого не змінює.
  async end(id, campaignId) {
    const { rows } = await pool.query(
      `UPDATE campaigns.combat_scenes
       SET ended_at = COALESCE(ended_at, NOW()), updated_at = NOW()
       WHERE id = $1 AND campaign_id = $2
       RETURNING *`,
      [id, campaignId]
    );
    return rows[0] || null;
  },

  // combatants cascade-delete with the scene (FK ON DELETE CASCADE).
  async remove(id, campaignId) {
    const { rowCount } = await pool.query(
      `DELETE FROM campaigns.combat_scenes WHERE id = $1 AND campaign_id = $2`,
      [id, campaignId]
    );
    return rowCount > 0;
  },
};

module.exports = CombatSceneModel;
