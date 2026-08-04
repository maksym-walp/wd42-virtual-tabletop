const pool = require('../config/db');

// admin.site_configs — key/value(jsonb) сховище конфігів сайту
// (55-weapon-grip-multi-and-admin-configs.sql). Наразі рівно два рядки
// (weapon_types, weapon_grips), але модель не знає про конкретні ключі —
// список дозволених ключів для запису живе в контролері.
const ConfigModel = {
  async findAll() {
    const { rows } = await pool.query('SELECT key, value, updated_at FROM admin.site_configs ORDER BY key');
    return rows;
  },

  async findByKey(key) {
    const { rows } = await pool.query('SELECT key, value, updated_at FROM admin.site_configs WHERE key = $1', [key]);
    return rows[0] || null;
  },

  async upsert(key, value) {
    const { rows } = await pool.query(
      `INSERT INTO admin.site_configs (key, value)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
       RETURNING key, value, updated_at`,
      [key, JSON.stringify(value)]
    );
    return rows[0];
  },
};

module.exports = ConfigModel;
