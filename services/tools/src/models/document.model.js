const pool = require('../config/db');

// Обидва інструменти (сузір'я, колоди) — це "документ": власник, назва, опис,
// прапорець публічності та JSONB-тіло, яке зберігається й віддається цілим.
// Фабрика приймає лише те, чим інструменти відрізняються:
//   table         — повна назва таблиці (tools.constellations)
//   extraColumns  — додаткові звичайні колонки (decks.back_image_url)
//   privateColumns — колонки, які пишуться як звичайні, але НЕ потрапляють у
//                   список (constellations.gm_notes); чи віддавати їх при
//                   читанні, вирішує контролер
//   listSelect    — SQL-вирази для списку: стислий підсумок замість важкого
//                   `data` (кількість зірок, картки тощо)
function createDocumentModel({ table, extraColumns = [], privateColumns = [], listSelect = '' }) {
  const writeColumns = ['name', 'description', 'is_public', ...extraColumns, ...privateColumns, 'data'];
  const listExtra = [...extraColumns.map((c) => `t.${c}`), listSelect].filter(Boolean).join(', ');

  const valuesOf = (fields) => writeColumns.map((column) => (
    column === 'data' ? JSON.stringify(fields.data) : fields[column] ?? null
  ));

  return {
    // scope: 'mine' | 'public' (публічні чужі) | без значення — власні та
    // публічні; адмін у цьому останньому випадку бачить усі.
    async findAll(userId, { scope, search } = {}, isAdmin = false) {
      const params = [userId];
      let visibility;
      if (scope === 'mine') visibility = 't.created_by = $1';
      else if (scope === 'public') visibility = 't.is_public = true AND t.created_by <> $1';
      else visibility = isAdmin ? 'TRUE' : '(t.created_by = $1 OR t.is_public = true)';

      const conditions = [visibility];
      if (search) {
        params.push(`%${search}%`);
        conditions.push(`t.name ILIKE $${params.length}`);
      }

      const { rows } = await pool.query(
        `SELECT t.id, t.created_by, t.name, t.description, t.is_public, t.created_at, t.updated_at,
                ${listExtra ? `${listExtra},` : ''}
                (t.created_by = $1) AS is_owner, u.username AS owner_username
         FROM ${table} t
         LEFT JOIN auth.users u ON u.id = t.created_by
         WHERE ${conditions.join(' AND ')}
         ORDER BY t.updated_at DESC, t.name ASC`,
        params
      );
      return rows;
    },

    // Без перевірки видимості: право читати/писати вирішує контролер.
    async findById(id, userId) {
      const { rows } = await pool.query(
        `SELECT t.*, (t.created_by = $2) AS is_owner, u.username AS owner_username
         FROM ${table} t
         LEFT JOIN auth.users u ON u.id = t.created_by
         WHERE t.id = $1`,
        [id, userId]
      );
      return rows[0] || null;
    },

    async create(userId, fields) {
      const columns = ['created_by', ...writeColumns];
      const { rows } = await pool.query(
        `INSERT INTO ${table} (${columns.join(', ')})
         VALUES (${columns.map((_, i) => (columns[i] === 'data' ? `$${i + 1}::jsonb` : `$${i + 1}`)).join(', ')})
         RETURNING *`,
        [userId, ...valuesOf(fields)]
      );
      return rows[0];
    },

    async update(id, fields) {
      const assignments = writeColumns.map((column, i) => (
        `${column} = $${i + 2}${column === 'data' ? '::jsonb' : ''}`
      ));
      const { rows } = await pool.query(
        `UPDATE ${table} SET ${assignments.join(', ')}, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id, ...valuesOf(fields)]
      );
      return rows[0] || null;
    },

    async remove(id) {
      const { rowCount } = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
      return rowCount > 0;
    },
  };
}

module.exports = createDocumentModel;
