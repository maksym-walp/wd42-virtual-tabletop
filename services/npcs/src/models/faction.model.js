const pool = require('../config/db');

const FactionModel = {
  async create({ createdBy, name, description, symbolUrl, isPublic }) {
    const { rows } = await pool.query(
      `INSERT INTO npcs.factions (created_by, name, description, symbol_url, is_public)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [createdBy, name, description ?? null, symbolUrl ?? null, isPublic ?? false]
    );
    return rows[0];
  },

  async findAll(userId, isAdmin) {
    const { rows } = await pool.query(
      `SELECT *, (created_by = $1) AS is_owner FROM npcs.factions
       WHERE ($2::bool OR created_by = $1 OR is_public = true)
       ORDER BY name ASC`,
      [userId, isAdmin]
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT *, (created_by = $2) AS is_owner FROM npcs.factions WHERE id = $1`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async update(id, { name, description, symbolUrl, isPublic }) {
    const { rows } = await pool.query(
      `UPDATE npcs.factions
       SET name = $2, description = $3, symbol_url = $4, is_public = $5, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, name, description ?? null, symbolUrl ?? null, isPublic ?? false]
    );
    return rows[0] || null;
  },

  async remove(id) {
    const { rowCount } = await pool.query(`DELETE FROM npcs.factions WHERE id = $1`, [id]);
    return rowCount > 0;
  },

  async setOwner(id, ownerUsername) {
    const { rows } = await pool.query(
      `UPDATE npcs.factions
       SET created_by = (SELECT id FROM auth.users WHERE username = $2), updated_at = NOW()
       WHERE id = $1 AND EXISTS (SELECT 1 FROM auth.users WHERE username = $2)
       RETURNING *`,
      [id, ownerUsername]
    );
    return rows[0] || null;
  },

  // Leaders — always NPCs, real FK into npcs.npcs, so a plain JOIN
  // suffices (no polymorphic lookup needed like members below).
  async findLeaders(factionId) {
    const { rows } = await pool.query(
      `SELECT fl.*,
              jsonb_build_object('id', e.id, 'name', e.name, 'image_url', e.image_url, 'image_crop', e.image_crop) AS npc
       FROM npcs.faction_leaders fl
       JOIN npcs.npcs e ON e.id = fl.npc_entry_id
       WHERE fl.faction_id = $1
       ORDER BY fl.created_at ASC`,
      [factionId]
    );
    return rows;
  },

  async addLeader(factionId, npcEntryId) {
    const { rows } = await pool.query(
      `INSERT INTO npcs.faction_leaders (faction_id, npc_entry_id)
       VALUES ($1, $2)
       ON CONFLICT (faction_id, npc_entry_id) DO NOTHING
       RETURNING *`,
      [factionId, npcEntryId]
    );
    return rows[0] || null;
  },

  async removeLeader(factionId, npcEntryId) {
    const { rowCount } = await pool.query(
      `DELETE FROM npcs.faction_leaders WHERE faction_id = $1 AND npc_entry_id = $2`,
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
                (SELECT jsonb_build_object('id', e.id, 'name', e.name, 'image_url', e.image_url, 'image_crop', e.image_crop)
                 FROM npcs.npcs e WHERE e.id = fm.member_id)
              ELSE
                (SELECT jsonb_build_object('id', c.id, 'name', c.name, 'image_url', c.image_url, 'image_crop', c.image_crop,
                                           'is_public', c.is_public, 'user_id', c.user_id)
                 FROM character_sheet.characters c WHERE c.id = fm.member_id)
              END AS member
       FROM npcs.faction_members fm
       WHERE fm.faction_id = $1
       ORDER BY fm.created_at ASC`,
      [factionId]
    );
    return rows;
  },

  // Upsert: re-adding an existing member just updates their role. Both the
  // faction page and the NPC page write through here, so the two views are
  // always the same rows.
  async addMember(factionId, memberType, memberId, role) {
    const { rows } = await pool.query(
      `INSERT INTO npcs.faction_members (faction_id, member_type, member_id, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (faction_id, member_type, member_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [factionId, memberType, memberId, role ?? null]
    );
    return rows[0] || null;
  },

  async updateMemberRole(factionId, memberType, memberId, role) {
    const { rows } = await pool.query(
      `UPDATE npcs.faction_members SET role = $4
       WHERE faction_id = $1 AND member_type = $2 AND member_id = $3
       RETURNING *`,
      [factionId, memberType, memberId, role ?? null]
    );
    return rows[0] || null;
  },

  // Every faction an NPC belongs to or leads, limited to factions the viewer
  // can see — the NPC page's "Фракції" block.
  async findMembershipsByNpc(npcId, userId, isAdmin) {
    const { rows } = await pool.query(
      `SELECT f.id, f.name, f.symbol_url, f.created_by, f.is_public,
              fm.role, (fm.id IS NOT NULL) AS is_member,
              EXISTS (SELECT 1 FROM npcs.faction_leaders fl
                      WHERE fl.faction_id = f.id AND fl.npc_entry_id = $1) AS is_leader
       FROM npcs.factions f
       LEFT JOIN npcs.faction_members fm
         ON fm.faction_id = f.id AND fm.member_type = 'npc' AND fm.member_id = $1
       WHERE (fm.id IS NOT NULL
              OR EXISTS (SELECT 1 FROM npcs.faction_leaders fl WHERE fl.faction_id = f.id AND fl.npc_entry_id = $1))
         AND ($3::bool OR f.created_by = $2 OR f.is_public = true)
       ORDER BY f.name ASC`,
      [npcId, userId, isAdmin]
    );
    return rows;
  },

  async removeMember(factionId, memberType, memberId) {
    const { rowCount } = await pool.query(
      `DELETE FROM npcs.faction_members WHERE faction_id = $1 AND member_type = $2 AND member_id = $3`,
      [factionId, memberType, memberId]
    );
    return rowCount > 0;
  },
};

module.exports = FactionModel;
