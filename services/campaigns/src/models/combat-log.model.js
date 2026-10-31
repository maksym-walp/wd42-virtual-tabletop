const pool = require('../config/db');

// Журнал бою (міграція 114): кожен автоматичний кидок має пояснити себе
// тому, кого він стосується. Атакувальник бачить результат одразу, а ціль —
// іншим екраном, через цей журнал: інакше в гравця просто мовчки зникає
// здоровʼя.
//
// Імена учасників зберігаються копією: комбатанта можуть прибрати зі сцени,
// а запис має лишитися читабельним.

const DEFAULT_LIMIT = 50;

const CombatLogModel = {
  async add(sceneId, { round_number, actor, target, kind, payload, is_gm_only }) {
    const { rows } = await pool.query(
      `INSERT INTO campaigns.combat_log_entries
         (combat_scene_id, round_number, actor_combatant_id, target_combatant_id,
          actor_name, target_name, kind, payload, is_gm_only)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       RETURNING *`,
      [
        sceneId, round_number ?? 1,
        actor?.id ?? null, target?.id ?? null,
        actor?.name ?? null, target?.name ?? null,
        kind, JSON.stringify(payload ?? {}), is_gm_only ?? false,
      ]
    );
    return rows[0];
  },

  // Найсвіжіші записи сцени. Гравцям віддаємо лише ті, що не стосуються
  // прихованих комбатантів — та сама межа, що й redactForPlayers у таблиці.
  async listByScene(sceneId, { includeGmOnly = false, limit = DEFAULT_LIMIT } = {}) {
    const { rows } = await pool.query(
      `SELECT * FROM campaigns.combat_log_entries
       WHERE combat_scene_id = $1 ${includeGmOnly ? '' : 'AND is_gm_only = false'}
       ORDER BY created_at DESC
       LIMIT $2`,
      [sceneId, Math.min(Math.max(1, Number(limit) || DEFAULT_LIMIT), 200)]
    );
    return rows;
  },
};

module.exports = CombatLogModel;
