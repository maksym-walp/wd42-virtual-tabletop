const pool = require('../config/db');

// Campaign → map "cards". map_id references maps.maps cross-schema (no FK).
// Auth is resolved in the controller.
const CampaignMapModel = {
  // Cards for a campaign, joined to maps.maps for display and filtered to maps
  // the requester can actually open (public, own, or admin) — so a GM's private
  // map never leaks as a clickable card to players. Dangling cards (map deleted)
  // drop out via the JOIN.
  async listByCampaign(campaignId, userId, admin) {
    const { rows } = await pool.query(
      `SELECT cm.id, cm.map_id, cm.created_at,
              m.name AS map_name, m.is_public, (m.created_by = $2) AS is_owner
       FROM campaigns.campaign_maps cm
       JOIN maps.maps m ON m.id = cm.map_id
       WHERE cm.campaign_id = $1
         AND ($3::bool OR m.is_public = true OR m.created_by = $2)
       ORDER BY cm.created_at DESC`,
      [campaignId, userId, admin]
    );
    return rows;
  },

  // Cross-schema existence check before linking.
  async mapExists(mapId) {
    const { rows } = await pool.query(
      `SELECT 1 FROM maps.maps WHERE id = $1 LIMIT 1`,
      [mapId]
    );
    return rows.length > 0;
  },

  async add(campaignId, mapId, addedBy) {
    const { rows } = await pool.query(
      `INSERT INTO campaigns.campaign_maps (campaign_id, map_id, added_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (campaign_id, map_id) DO NOTHING
       RETURNING *`,
      [campaignId, mapId, addedBy]
    );
    return rows[0] || null; // null => the map was already linked
  },

  async remove(id, campaignId) {
    const { rowCount } = await pool.query(
      `DELETE FROM campaigns.campaign_maps WHERE id = $1 AND campaign_id = $2`,
      [id, campaignId]
    );
    return rowCount > 0;
  },
};

module.exports = CampaignMapModel;
