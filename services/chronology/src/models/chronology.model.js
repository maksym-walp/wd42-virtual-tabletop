const pool = require('../config/db');

// Структура календаря для згенерованої мініатюри на картках (каталог /chronology
// і блок календаря кампанії) — одним запитом замість чотирьох list-ендпоінтів
// на кожну картку. Поля ті самі, що віддають відповідні list-ендпоінти.
const PREVIEW_COLUMNS = `
  (SELECT COALESCE(json_agg(json_build_object('id', m.id, 'name', m.name, 'length', m.length) ORDER BY m.order_num), '[]'::json)
     FROM chronology.calendar_months m WHERE m.calendar_id = c.id) AS preview_months,
  (SELECT COALESCE(json_agg(json_build_object('name', w.name, 'short_name', w.short_name) ORDER BY w.order_num), '[]'::json)
     FROM chronology.calendar_weekdays w WHERE w.calendar_id = c.id) AS preview_weekdays,
  (SELECT COALESCE(json_agg(json_build_object('id', s.id, 'name', s.name, 'start_month_id', s.start_month_id,
            'start_day', s.start_day, 'color', s.color, 'bg_image_url', s.bg_image_url)), '[]'::json)
     FROM chronology.calendar_seasons s WHERE s.calendar_id = c.id) AS preview_seasons,
  (SELECT COALESCE(json_agg(json_build_object('id', mo.id, 'name', mo.name, 'cycle_length', mo.cycle_length,
            'shift', mo.shift, 'color', mo.color)), '[]'::json)
     FROM chronology.calendar_moons mo WHERE mo.calendar_id = c.id) AS preview_moons,
  (SELECT COALESCE(json_agg(json_build_object('id', er.id, 'name', er.name, 'start_year', er.start_year,
            'start_month_id', er.start_month_id, 'start_day', er.start_day, 'cycle_years', er.cycle_years)
            ORDER BY er.start_year, er.start_day), '[]'::json)
     FROM chronology.calendar_eras er WHERE er.calendar_id = c.id) AS preview_eras`;

const ChronologyModel = {
  // Visible to the requester: public calendars, their own (any visibility),
  // or everything if admin. Mirrors maps.maps' owner+admin/public convention,
  // inverted for the is_private field this table uses instead of is_public.
  async findAll(userId, isAdmin = false) {
    const visibility = isAdmin ? 'TRUE' : '(c.is_private = false OR c.creator_id = $1)';
    const { rows } = await pool.query(
      `SELECT c.*, (c.creator_id = $1) AS is_owner, ${PREVIEW_COLUMNS}
       FROM chronology.calendars c
       WHERE ${visibility}
       ORDER BY c.is_default DESC, c.name ASC`,
      [userId]
    );
    return rows;
  },

  // Same visibility rule as findAll, single row, id-scoped.
  async findById(id, userId, isAdmin = false) {
    const visibility = isAdmin ? 'TRUE' : '(c.is_private = false OR c.creator_id = $2)';
    const { rows } = await pool.query(
      `SELECT c.*, (c.creator_id = $2) AS is_owner, ${PREVIEW_COLUMNS}
       FROM chronology.calendars c
       WHERE c.id = $1 AND ${visibility}`,
      [id, userId]
    );
    return rows[0] || null;
  },

  // Existence check with no visibility filter, for write paths already
  // gated by requireChronologyManager (admin/game_master may manage any
  // calendar, not just their own).
  async findByIdRaw(id) {
    const { rows } = await pool.query(`SELECT * FROM chronology.calendars WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  async create(creatorId, data) {
    const {
      name, description, current_era_name, previous_era_name,
      first_day_offset, is_private,
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO chronology.calendars
         (creator_id, name, description, current_era_name, previous_era_name, first_day_offset, is_private)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [creatorId, name, description ?? null, current_era_name ?? null, previous_era_name ?? null,
        first_day_offset ?? 0, is_private ?? false]
    );
    return rows[0];
  },

  async update(id, data) {
    const {
      name, description, current_era_name, previous_era_name,
      first_day_offset, is_private, default_year, default_month_id,
      term_day, term_week, term_month, term_season, term_year,
      week_length, default_day,
    } = data;

    const { rows } = await pool.query(
      `UPDATE chronology.calendars
       SET name=$2, description=$3, current_era_name=$4, previous_era_name=$5,
           first_day_offset=$6, is_private=$7, default_year=$8, default_month_id=$9,
           term_day=$10, term_week=$11, term_season=$12, term_year=$13, term_month=$14,
           week_length=$15, default_day=$16, updated_at=NOW()
       WHERE id=$1
       RETURNING *`,
      [id, name, description ?? null, current_era_name ?? null, previous_era_name ?? null,
        first_day_offset ?? 0, is_private ?? false, default_year ?? null, default_month_id ?? null,
        term_day || null, term_week || null, term_season || null, term_year || null, term_month || null,
        week_length || null, default_day || null]
    );
    return rows[0] || null;
  },

  // Не більше одного календаря за замовчуванням (частковий унікальний індекс
  // uq_calendars_single_default): попередній знімається в тій самій транзакції,
  // що ставить новий. Прапорець не входить у update() — загальне збереження
  // налаштувань (доступне й майстрам) його не чіпає.
  //
  // Синхронізація (sync_offset_days, міграція 98) відлічується від спільної
  // осі, прив'язаної до колишнього основного календаря. Тому: календар, що
  // перестає бути основним, зберігає свою позицію на осі (NULL → 0); новий
  // основний без зсуву осі не має — тоді всі інші втрачають синхронізацію
  // (їх треба синхронізувати з ним заново), а він сам стає початком осі.
  async setDefault(id, isDefault) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let row = null;
      if (isDefault) {
        const { rows: [target] } = await client.query(
          `SELECT sync_offset_days FROM chronology.calendars WHERE id = $1 FOR UPDATE`, [id]
        );
        if (target) {
          await client.query(
            `UPDATE chronology.calendars
             SET is_default = false, sync_offset_days = COALESCE(sync_offset_days, 0)
             WHERE is_default AND id <> $1`,
            [id]
          );
          if (target.sync_offset_days == null) {
            await client.query(`UPDATE chronology.calendars SET sync_offset_days = NULL WHERE id <> $1`, [id]);
          }
          const { rows } = await client.query(
            `UPDATE chronology.calendars
             SET is_default = true, sync_offset_days = COALESCE(sync_offset_days, 0)
             WHERE id = $1 RETURNING *`,
            [id]
          );
          row = rows[0];
        }
      } else {
        const { rows } = await client.query(
          `UPDATE chronology.calendars
           SET is_default = false, sync_offset_days = COALESCE(sync_offset_days, 0)
           WHERE id = $1 RETURNING *`,
          [id]
        );
        row = rows[0];
      }
      await client.query('COMMIT');
      return row || null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Зсув синхронізації з календарем за замовчуванням (NULL — вимкнути).
  // Основному календарю зсув не задається (контролер це відсікає).
  async setSyncOffset(id, offset) {
    const { rows } = await pool.query(
      `UPDATE chronology.calendars SET sync_offset_days = $2 WHERE id = $1 RETURNING *`,
      [id, offset]
    );
    return rows[0] || null;
  },

  async hasDefault() {
    const { rows } = await pool.query(`SELECT 1 FROM chronology.calendars WHERE is_default LIMIT 1`);
    return rows.length > 0;
  },

  async delete(id) {
    const { rowCount } = await pool.query(`DELETE FROM chronology.calendars WHERE id = $1`, [id]);
    return rowCount > 0;
  },

  // default_month_id must belong to this same calendar — same guard as
  // calendar_seasons.start_month_id (see chronology-season.model.js).
  async monthBelongsToCalendar(monthId, calendarId) {
    const { rows } = await pool.query(
      `SELECT 1 FROM chronology.calendar_months WHERE id = $1 AND calendar_id = $2 LIMIT 1`,
      [monthId, calendarId]
    );
    return rows.length > 0;
  },
};

module.exports = ChronologyModel;
