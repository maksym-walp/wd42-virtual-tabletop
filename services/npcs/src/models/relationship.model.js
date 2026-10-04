const pool = require('../config/db');

// Directed NPC relationships: "target is <label> to npc_id". The target is
// polymorphic (another NPC or a player character in character_sheet), so it
// is resolved per row like faction members. Rows whose target the viewer
// cannot see are left out ($2 = viewer, $3 = is admin), so a public NPC never
// leaks the name of someone's private NPC/character.
const RelationshipModel = {
  async findOutgoing(npcId, userId, isAdmin) {
    const { rows } = await pool.query(
      `SELECT r.*, t.target
       FROM npcs.npc_relationships r
       CROSS JOIN LATERAL (
         SELECT jsonb_build_object('id', n.id, 'name', n.name, 'image_url', n.image_url, 'image_crop', n.image_crop) AS target
         FROM npcs.npcs n
         WHERE r.target_type = 'npc' AND n.id = r.target_id
           AND ($3::bool OR n.created_by = $2 OR n.is_public = true)
         UNION ALL
         SELECT jsonb_build_object('id', c.id, 'name', c.name, 'image_url', c.image_url, 'image_crop', c.image_crop,
                                   'is_public', c.is_public, 'is_owner', c.user_id = $2)
         FROM character_sheet.characters c
         WHERE r.target_type = 'character' AND c.id = r.target_id
           AND ($3::bool OR c.user_id = $2 OR c.is_public = true)
       ) t
       WHERE r.npc_id = $1
       ORDER BY r.created_at ASC`,
      [npcId, userId, isAdmin]
    );
    return rows;
  },

  // Other NPCs that point at this NPC — the "Згадується у зв'язках" block.
  async findIncoming(npcId, userId, isAdmin) {
    const { rows } = await pool.query(
      `SELECT r.id, r.npc_id, r.label, r.note, r.created_at,
              jsonb_build_object('id', n.id, 'name', n.name, 'image_url', n.image_url, 'image_crop', n.image_crop) AS npc
       FROM npcs.npc_relationships r
       JOIN npcs.npcs n ON n.id = r.npc_id
       WHERE r.target_type = 'npc' AND r.target_id = $1
         AND ($3::bool OR n.created_by = $2 OR n.is_public = true)
       ORDER BY n.name ASC`,
      [npcId, userId, isAdmin]
    );
    return rows;
  },

  async create(npcId, { targetType, targetId, label, note }) {
    const { rows } = await pool.query(
      `INSERT INTO npcs.npc_relationships (npc_id, target_type, target_id, label, note)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (npc_id, target_type, target_id) DO NOTHING
       RETURNING *`,
      [npcId, targetType, targetId, label, note ?? null]
    );
    return rows[0] || null;
  },

  async update(npcId, relationshipId, { label, note }) {
    const { rows } = await pool.query(
      `UPDATE npcs.npc_relationships
       SET label = $3, note = $4, updated_at = NOW()
       WHERE id = $2 AND npc_id = $1
       RETURNING *`,
      [npcId, relationshipId, label, note ?? null]
    );
    return rows[0] || null;
  },

  async remove(npcId, relationshipId) {
    const { rowCount } = await pool.query(
      `DELETE FROM npcs.npc_relationships WHERE id = $2 AND npc_id = $1`,
      [npcId, relationshipId]
    );
    return rowCount > 0;
  },
};

module.exports = RelationshipModel;
