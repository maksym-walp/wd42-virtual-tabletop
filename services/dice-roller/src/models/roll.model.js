const pool = require('../config/db');

const RollModel = {
  async create(userId, { formula, total, groups }) {
    const { rows } = await pool.query(
      `INSERT INTO dice_roller.rolls (user_id, formula, total, groups)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, formula, total, JSON.stringify(groups)]
    );
    return rows[0];
  },

  async findHistory(userId, { limit = 20, offset = 0 } = {}) {
    const { rows } = await pool.query(
      `SELECT * FROM dice_roller.rolls
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  },

  async getStats(userId) {
    const [{ rows: summaryRows }, { rows: byDieRows }] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total_rolls, MAX(created_at) AS last_roll_at
         FROM dice_roller.rolls
         WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        `WITH plain_dice AS (
           SELECT (g->>'sides')::int AS sides, elem::int AS value
           FROM dice_roller.rolls r,
                jsonb_array_elements(r.groups) AS g,
                jsonb_array_elements_text(g->'rolls') AS elem
           WHERE r.user_id = $1 AND g->>'type' = 'dice'
         ),
         wrapped_dice AS (
           SELECT (g->>'sides')::int AS sides, (d->>'kept')::int AS value
           FROM dice_roller.rolls r,
                jsonb_array_elements(r.groups) AS g,
                jsonb_array_elements(g->'dice') AS d
           WHERE r.user_id = $1 AND g->>'type' IN ('adv', 'dis', 'wadv', 'wdis')
         ),
         all_dice AS (
           SELECT * FROM plain_dice
           UNION ALL
           SELECT * FROM wrapped_dice
         )
         SELECT
           sides,
           COUNT(*)::int AS count,
           SUM(value)::int AS sum,
           MIN(value)::int AS min,
           MAX(value)::int AS max,
           COUNT(*) FILTER (WHERE sides = 20 AND value = 20)::int AS nat20_count,
           COUNT(*) FILTER (WHERE sides = 20 AND value = 1)::int AS nat1_count
         FROM all_dice
         GROUP BY sides
         ORDER BY sides`,
        [userId]
      ),
    ]);

    const summary = summaryRows[0];
    const totalDiceRolled = byDieRows.reduce((sum, row) => sum + row.count, 0);
    const nat20Count = byDieRows.find((row) => row.sides === 20)?.nat20_count || 0;
    const nat1Count = byDieRows.find((row) => row.sides === 20)?.nat1_count || 0;

    return {
      total_rolls: summary.total_rolls,
      last_roll_at: summary.last_roll_at,
      total_dice_rolled: totalDiceRolled,
      nat20_count: nat20Count,
      nat1_count: nat1Count,
      by_die: byDieRows.map(({ sides, count, sum, min, max }) => ({ sides, count, sum, min, max })),
    };
  },
};

module.exports = RollModel;
