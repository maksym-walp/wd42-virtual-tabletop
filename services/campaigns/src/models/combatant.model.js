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
    initiative, notes, description, is_hidden, max_health, temp_hp,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO campaigns.combatants (
         combat_scene_id, character_id, name, passive_defense, active_defense,
         health, initiative, notes, description, is_hidden, max_health, temp_hp
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        sceneId, character_id ?? null, name,
        passive_defense ?? null, active_defense ?? null, health ?? null,
        initiative ?? null, notes ?? null, description ?? null, is_hidden ?? false,
        max_health ?? null, temp_hp ?? null,
      ]
    );
    return rows[0];
  },

  // Clones N independent combatant rows from one compendium entry (e.g. 3
  // Goblins), each with its own id/name and the same pre-computed starting
  // stats — all-or-nothing via a transaction, since a partial clone would
  // leave a confusing half-added group in the tracker.
  async addMany(sceneId, combatantsData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = [];
      for (const data of combatantsData) {
        const { rows } = await client.query(
          `INSERT INTO campaigns.combatants (
             combat_scene_id, compendium_entry_id, name, passive_defense, active_defense,
             health, initiative, notes, description, is_hidden, max_health, temp_hp
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [
            sceneId, data.compendium_entry_id ?? null, data.name,
            data.passive_defense ?? null, data.active_defense ?? null, data.health ?? null,
            data.initiative ?? null, data.notes ?? null, data.description ?? null, data.is_hidden ?? false,
            data.max_health ?? null, data.temp_hp ?? null,
          ]
        );
        inserted.push(rows[0]);
      }
      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async update(id, campaignId, {
    name, passive_defense, active_defense, health,
    initiative, notes, description, is_hidden, max_health, temp_hp,
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
           max_health      = COALESCE($11, c.max_health),
           temp_hp         = COALESCE($12, c.temp_hp),
           updated_at      = NOW()
       FROM campaigns.combat_scenes s
       WHERE c.id = $1 AND c.combat_scene_id = s.id AND s.campaign_id = $2
       RETURNING c.*`,
      [
        id, campaignId, name ?? null, passive_defense ?? null, active_defense ?? null,
        health ?? null, initiative ?? null, notes ?? null, description ?? null,
        is_hidden ?? null, max_health ?? null, temp_hp ?? null,
      ]
    );
    return rows[0] || null;
  },

  // Чи належить цей комбатант персонажу, яким володіє userId — саме на
  // цій перевірці тримається дозвіл гравцю правити ХП/ініціативу/захист
  // лише свого рядка (combatants не має власної campaign_id, тож заодно
  // скоупимо через combat_scenes, як і в інших методах цієї моделі).
  async isOwnedByUser(combatantId, campaignId, userId) {
    const { rows } = await pool.query(
      `SELECT 1
       FROM campaigns.combatants c
       JOIN campaigns.combat_scenes s ON s.id = c.combat_scene_id
       JOIN character_sheet.characters ch ON ch.id = c.character_id
       WHERE c.id = $1 AND s.campaign_id = $2 AND ch.user_id = $3
       LIMIT 1`,
      [combatantId, campaignId, userId]
    );
    return rows.length > 0;
  },

  // Зворотний бік двосторонньої синхронізації ХП: лист персонажа не знає,
  // у якій кампанії/сцені персонаж зараз б'ється, тож оновлюємо ВСІ його
  // комбатантів одразу (character_id, без прив'язки до конкретної кампанії).
  async updateHpByCharacterId(characterId, { health, temp_hp }) {
    const { rows } = await pool.query(
      `UPDATE campaigns.combatants
       SET health = COALESCE($2, health), temp_hp = COALESCE($3, temp_hp), updated_at = NOW()
       WHERE character_id = $1
       RETURNING *`,
      [characterId, health ?? null, temp_hp ?? null]
    );
    return rows;
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
