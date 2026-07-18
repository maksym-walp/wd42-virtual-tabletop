const pool = require('../config/db');

// Aggregate a single user's PUBLIC activity across every domain schema. The
// user-profile service shares the one Postgres instance, so it reads the other
// schemas directly (same cross-schema convention as character-sheet -> auth).
// Every query is scoped to `user_id = $1 AND is_public = true`, so nothing
// private is ever exposed. Rows carry `is_owner = true` so the reused frontend
// cards don't tag every entry as "чуже".
const PublicProfileModel = {
  // Resolve the public identity. Returns { id, username } or null.
  async findUserByUsername(username) {
    const { rows } = await pool.query(
      `SELECT id, username FROM auth.users WHERE username = $1 AND is_active = true`,
      [username]
    );
    return rows[0] || null;
  },

  async getPublicActivity(userId) {
    const [characters, equipment, spells, abilities, maneuvers, collections] = await Promise.all([
      pool.query(
        `SELECT id, name, archetype, race, race_ancestry, is_public, created_at
           FROM character_sheet.characters
          WHERE user_id = $1 AND is_public = true
          ORDER BY created_at DESC`,
        [userId]
      ),
      pool.query(
        `SELECT *, true AS is_owner
           FROM equipment.items
          WHERE user_id = $1 AND is_public = true
          ORDER BY name ASC`,
        [userId]
      ),
      pool.query(
        `SELECT *, true AS is_owner
           FROM spellbook.spells
          WHERE user_id = $1 AND is_public = true
          ORDER BY name ASC`,
        [userId]
      ),
      pool.query(
        `SELECT *, true AS is_owner
           FROM abilities.entries
          WHERE user_id = $1 AND is_public = true
          ORDER BY name ASC`,
        [userId]
      ),
      pool.query(
        `SELECT *, true AS is_owner
           FROM maneuvers.entries
          WHERE user_id = $1 AND is_public = true
          ORDER BY name ASC`,
        [userId]
      ),
      // Public collections across all four domains, tagged with their domain so
      // the frontend can link each to the right collections view.
      pool.query(
        `SELECT id, name, description, is_public, created_at, 'equipment' AS domain
           FROM equipment.collections WHERE user_id = $1 AND is_public = true
         UNION ALL
         SELECT id, name, description, is_public, created_at, 'spellbook' AS domain
           FROM spellbook.collections WHERE user_id = $1 AND is_public = true
         UNION ALL
         SELECT id, name, description, is_public, created_at, 'abilities' AS domain
           FROM abilities.collections WHERE user_id = $1 AND is_public = true
         UNION ALL
         SELECT id, name, description, is_public, created_at, 'maneuvers' AS domain
           FROM maneuvers.collections WHERE user_id = $1 AND is_public = true
         ORDER BY name ASC`,
        [userId]
      ),
    ]);

    return {
      characters: characters.rows,
      equipment: equipment.rows,
      spells: spells.rows,
      abilities: abilities.rows,
      maneuvers: maneuvers.rows,
      collections: collections.rows,
    };
  },
};

module.exports = PublicProfileModel;
