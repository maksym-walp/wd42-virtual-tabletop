const pool = require('../config/db');

const FactionModel = {
  async create({ createdBy, name, description, symbolUrl, isPublic }) {
    const { rows } = await pool.query(
      `INSERT INTO compendium.factions (created_by, name, description, symbol_url, is_public)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [createdBy, name, description ?? null, symbolUrl ?? null, isPublic ?? false]
    );
    return rows[0];
  },

  async findAll(userId, isAdmin) {
    const { rows } = await pool.query(
      `SELECT *, (created_by = $1) AS is_owner FROM compendium.factions
       WHERE ($2::bool OR created_by = $1 OR is_public = true)
       ORDER BY name ASC`,
      [userId, isAdmin]
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT *, (created_by = $2) AS is_owner FROM compendium.factions WHERE id = $1`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async update(id, { name, description, symbolUrl, isPublic }) {
    const { rows } = await pool.query(
      `UPDATE compendium.factions
       SET name = $2, description = $3, symbol_url = $4, is_public = $5, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, name, description ?? null, symbolUrl ?? null, isPublic ?? false]
    );
    return rows[0] || null;
  },

  async remove(id) {
    const { rowCount } = await pool.query(`DELETE FROM compendium.factions WHERE id = $1`, [id]);
    return rowCount > 0;
  },

  async setOwner(id, ownerUsername) {
    const { rows } = await pool.query(
      `UPDATE compendium.factions
       SET created_by = (SELECT id FROM auth.users WHERE username = $2), updated_at = NOW()
       WHERE id = $1 AND EXISTS (SELECT 1 FROM auth.users WHERE username = $2)
       RETURNING *`,
      [id, ownerUsername]
    );
    return rows[0] || null;
  },

  // Leaders — always NPCs, real FK into compendium_entries, so a plain
  // LEFT JOIN suffices (no cross-schema union needed like members below).
  async findLeaders(factionId) {
    const { rows } = await pool.query(
      `SELECT fl.*,
              jsonb_build_object('id', e.id, 'name', e.name, 'image_url', e.image_url) AS npc
       FROM compendium.faction_leaders fl
       JOIN compendium.compendium_entries e ON e.id = fl.npc_entry_id
       WHERE fl.faction_id = $1
       ORDER BY fl.created_at ASC`,
      [factionId]
    );
    return rows;
  },

  async addLeader(factionId, npcEntryId) {
    const { rows } = await pool.query(
      `INSERT INTO compendium.faction_leaders (faction_id, npc_entry_id)
       VALUES ($1, $2)
       ON CONFLICT (faction_id, npc_entry_id) DO NOTHING
       RETURNING *`,
      [factionId, npcEntryId]
    );
    return rows[0] || null;
  },

  async removeLeader(factionId, npcEntryId) {
    const { rowCount } = await pool.query(
      `DELETE FROM compendium.faction_leaders WHERE faction_id = $1 AND npc_entry_id = $2`,
      [factionId, npcEntryId]
    );
    return rowCount > 0;
  },

  // Members — NPC or player character, two different schemas behind one
  // polymorphic (member_type, member_id) pair. No single JOIN can reach
  // both, so each row is enriched from whichever source it points at.
  async findMembers(factionId) {
    const { rows } = await pool.query(
      `SELECT fm.*,
              CASE WHEN fm.member_type = 'npc' THEN
                (SELECT jsonb_build_object('id', e.id, 'name', e.name, 'image_url', e.image_url)
                 FROM compendium.compendium_entries e WHERE e.id = fm.member_id)
              ELSE
                (SELECT jsonb_build_object('id', c.id, 'name', c.name)
                 FROM character_sheet.characters c WHERE c.id = fm.member_id)
              END AS member
       FROM compendium.faction_members fm
       WHERE fm.faction_id = $1
       ORDER BY fm.created_at ASC`,
      [factionId]
    );
    return rows;
  },

  async addMember(factionId, memberType, memberId) {
    const { rows } = await pool.query(
      `INSERT INTO compendium.faction_members (faction_id, member_type, member_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (faction_id, member_type, member_id) DO NOTHING
       RETURNING *`,
      [factionId, memberType, memberId]
    );
    return rows[0] || null;
  },

  async removeMember(factionId, memberType, memberId) {
    const { rowCount } = await pool.query(
      `DELETE FROM compendium.faction_members WHERE faction_id = $1 AND member_type = $2 AND member_id = $3`,
      [factionId, memberType, memberId]
    );
    return rowCount > 0;
  },
};

module.exports = FactionModel;
