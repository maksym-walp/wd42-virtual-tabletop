const pool = require('../config/db');

// Стан персонажа, яким керують правила (src/rules/): стани, шкала смерті,
// вітали, таймер діяльності, останній відпочинок і звикання до зілля. Зміни йдуть у транзакції
// з блокуванням рядка, щоб паралельні таймер/відпочинок не затерли одне одного.

const STATE_FIELDS = [
  'conditions', 'death_scale', 'current_hp', 'temp_hp', 'current_magic', 'heroic_actions_used',
  'rest_timer_hours', 'timer_checks_done', 'timer_checks_passed', 'last_rest',
  'potion_habit_rank', 'potion_habituated', 'potion_excess_portions',
];
const JSON_FIELDS = new Set(['conditions', 'last_rest']);

const CharacterStateModel = {
  // fn(client, { character, skills }) у транзакції з SELECT … FOR UPDATE.
  // null — персонажа нема.
  async withCharacterLock(id, fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [character] } = await client.query(
        `SELECT * FROM character_sheet.characters WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (!character) { await client.query('ROLLBACK'); return null; }
      const { rows: skills } = await client.query(
        `SELECT * FROM character_sheet.skills WHERE character_id = $1 ORDER BY skill_key`,
        [id]
      );
      const result = await fn(client, { character, skills });
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Записує лише поля з STATE_FIELDS, що є в fields.
  async saveState(client, id, fields) {
    const sets = [];
    const params = [id];
    for (const key of STATE_FIELDS) {
      if (!(key in fields)) continue;
      const value = fields[key];
      params.push(JSON_FIELDS.has(key) && value != null ? JSON.stringify(value) : value);
      sets.push(`${key} = $${params.length}${JSON_FIELDS.has(key) ? '::jsonb' : ''}`);
    }
    if (!sets.length) {
      const { rows: [row] } = await client.query(`SELECT * FROM character_sheet.characters WHERE id = $1`, [id]);
      return row || null;
    }
    const { rows: [row] } = await client.query(
      `UPDATE character_sheet.characters SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      params
    );
    return row || null;
  },

  // Постійний ефект Травми 5: навички Тілобудови падають до мінімуму свого
  // рівня, кола прогресу обнуляються.
  async resetPhysique(client, id, keys, value) {
    await client.query(
      `UPDATE character_sheet.skills
       SET value = LEAST(value, $3), progress_marks = 0
       WHERE character_id = $1 AND skill_key = ANY($2::text[])`,
      [id, keys, value]
    );
    const { rows } = await client.query(
      `SELECT * FROM character_sheet.skills WHERE character_id = $1 ORDER BY skill_key`,
      [id]
    );
    return rows;
  },

  // false — ці години з таким source_key персонаж уже отримав.
  async insertTimerEvent(client, id, sourceKey, hours) {
    const { rowCount } = await client.query(
      `INSERT INTO character_sheet.timer_events (character_id, source_key, hours)
       VALUES ($1, $2, $3)
       ON CONFLICT (character_id, source_key) DO NOTHING`,
      [id, sourceKey, hours]
    );
    return rowCount > 0;
  },

  // Персонажі з ids, яких userId може бачити в трекері бою: власні, з
  // кампаній, де він ГМ, або з кампаній, де він має свого персонажа.
  async findVisible(ids, userId, isAdmin = false) {
    const { rows } = await pool.query(
      `SELECT c.* FROM character_sheet.characters c
       WHERE c.id = ANY($1::uuid[])
         AND ($3 = true OR c.user_id = $2 OR EXISTS (
           SELECT 1 FROM campaigns.campaign_characters cc
           JOIN campaigns.campaigns cp ON cp.id = cc.campaign_id
           WHERE cc.character_id = c.id
             AND (cp.gm_id = $2 OR EXISTS (
               SELECT 1 FROM campaigns.campaign_characters mine
               JOIN character_sheet.characters mc ON mc.id = mine.character_id
               WHERE mine.campaign_id = cc.campaign_id AND mc.user_id = $2))))`,
      [ids, userId, isAdmin]
    );
    return rows;
  },

  async findSkills(ids) {
    const { rows } = await pool.query(
      `SELECT * FROM character_sheet.skills WHERE character_id = ANY($1::uuid[]) ORDER BY skill_key`,
      [ids]
    );
    return rows;
  },

  // Кампанії персонажа — лист підписується на їхні SSE-потоки.
  async campaignIdsFor(id) {
    const { rows } = await pool.query(
      `SELECT campaign_id FROM campaigns.campaign_characters WHERE character_id = $1`,
      [id]
    );
    return rows.map((r) => r.campaign_id);
  },
};

module.exports = CharacterStateModel;
