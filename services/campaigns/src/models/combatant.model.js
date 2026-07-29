const pool = require('../config/db');

// combatants has no campaign_id column of its own — every write scoped by
// campaign is joined through combat_scenes, so a guessed combatant id can
// never touch a row that belongs to another campaign's scene.
const CombatantModel = {
  async listByScene(sceneId) {
    const { rows } = await pool.query(
      `SELECT * FROM campaigns.combatants
       WHERE combat_scene_id = $1
       ORDER BY initiative DESC NULLS LAST, created_at`,
      [sceneId]
    );
    return rows;
  },

  async add(sceneId, {
    character_id, name, passive_defense, active_defense, health,
    initiative, notes, description, is_hidden,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO campaigns.combatants (
         combat_scene_id, character_id, name, passive_defense, active_defense,
         health, initiative, notes, description, is_hidden
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        sceneId, character_id ?? null, name,
        passive_defense ?? null, active_defense ?? null, health ?? null,
        initiative ?? null, notes ?? null, description ?? null, is_hidden ?? false,
      ]
    );
    return rows[0];
  },

  async update(id, campaignId, {
    name, passive_defense, active_defense, health,
    initiative, notes, description, is_hidden,
  } = {}) {
    const { rows } = await pool.query(
      `UPDATE campaigns.combatants c
       SET name            = COALESCE($3, c.name),
           passive_defense = COALESCE($4, c.passive_defense),
           active_defense  = COALESCE($5, c.active_defense),
           health          = COALESCE($6, c.health),
           initiative      = COALESCE($7, c.initiative),
           notes           = COALESCE($8, c.notes),
           description     = COALESCE($9, c.description),
           is_hidden       = COALESCE($10, c.is_hidden),
           updated_at      = NOW()
       FROM campaigns.combat_scenes s
       WHERE c.id = $1 AND c.combat_scene_id = s.id AND s.campaign_id = $2
       RETURNING c.*`,
      [
        id, campaignId, name ?? null, passive_defense ?? null, active_defense ?? null,
        health ?? null, initiative ?? null, notes ?? null, description ?? null,
        is_hidden ?? null,
      ]
    );
    return rows[0] || null;
  },

  async remove(id, campaignId) {
    const { rowCount } = await pool.query(
      `DELETE FROM campaigns.combatants c
       USING campaigns.combat_scenes s
       WHERE c.id = $1 AND c.combat_scene_id = s.id AND s.campaign_id = $2`,
      [id, campaignId]
    );
    return rowCount > 0;
  },

  // Хто діє наступним: найвища ініціатива серед тих, хто ще не походив
  // цього раунду (NULL-ініціатива — в кінці черги).
  async findNextToAct(sceneId) {
    const { rows } = await pool.query(
      `SELECT * FROM campaigns.combatants
       WHERE combat_scene_id = $1 AND has_acted_this_round = false
       ORDER BY initiative DESC NULLS LAST
       LIMIT 1`,
      [sceneId]
    );
    return rows[0] || null;
  },

  async markActed(id) {
    const { rows } = await pool.query(
      `UPDATE campaigns.combatants SET has_acted_this_round = true, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return rows[0] || null;
  },
};

module.exports = CombatantModel;
