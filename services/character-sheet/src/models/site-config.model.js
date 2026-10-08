const pool = require('../config/db');

// Стани й валюти персонажа редагуються з адмін-панелі й живуть у
// admin.site_configs — той самий Postgres, що й campaigns.* у
// campaign-access.model.js, тож звичайний cross-schema SELECT.
const SiteConfigModel = {
  async getCharacterConfig() {
    const { rows } = await pool.query(
      `SELECT key, value FROM admin.site_configs WHERE key IN ('conditions', 'currencies')`
    );
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      conditions: byKey.conditions || [],
      currencies: byKey.currencies || [],
    };
  },
};

module.exports = SiteConfigModel;
