const pool = require('../config/db');

const SettingsModel = {
  async findAll() {
    const { rows } = await pool.query(
      `SELECT archetype, background_url, layout FROM skill_tree.archetype_settings`
    );
    return rows;
  },

  // `patch` carries only the keys the client sent. background_url is a
  // "key present" field: NULL is a real value (clears the image), so COALESCE
  // would make removing a background impossible.
  async upsert(archetype, patch) {
    const setBackground = 'background_url' in patch;
    const setLayout = 'layout' in patch;
    const { rows } = await pool.query(
      `INSERT INTO skill_tree.archetype_settings (archetype, background_url, layout)
       VALUES ($1, $3::varchar, COALESCE($5::varchar, 'tree'))
       ON CONFLICT (archetype) DO UPDATE SET
         background_url = CASE WHEN $2::boolean THEN $3::varchar ELSE skill_tree.archetype_settings.background_url END,
         layout         = CASE WHEN $4::boolean THEN $5::varchar ELSE skill_tree.archetype_settings.layout END,
         updated_at     = NOW()
       RETURNING archetype, background_url, layout`,
      [
        archetype,
        setBackground,
        setBackground ? patch.background_url : null,
        setLayout,
        setLayout ? patch.layout : null,
      ]
    );
    return rows[0];
  },
};

module.exports = SettingsModel;
