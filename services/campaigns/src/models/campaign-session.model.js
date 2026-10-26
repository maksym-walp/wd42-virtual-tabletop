const pool = require('../config/db');

// Past-session recaps written by the GM. Auth is resolved in the controller,
// same convention as campaign-gallery.model.js / campaign-map.model.js.
const CampaignSessionModel = {
  async listByCampaign(campaignId) {
    const { rows } = await pool.query(
      `SELECT * FROM campaigns.campaign_sessions
       WHERE campaign_id = $1
       ORDER BY session_date NULLS LAST, created_at`,
      [campaignId]
    );
    return rows;
  },

  async add(campaignId, { title, content, session_date, visited_locations, related_events, npcs }) {
    const { rows } = await pool.query(
      `INSERT INTO campaigns.campaign_sessions
         (campaign_id, title, content, session_date, visited_locations, related_events, npcs)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [campaignId, title, content ?? null, session_date ?? null,
        visited_locations ?? null, related_events ?? null, npcs ?? null]
    );
    return rows[0];
  },

  async update(id, campaignId, { title, content, session_date, visited_locations, related_events, npcs }) {
    const { rows } = await pool.query(
      `UPDATE campaigns.campaign_sessions
       SET title = $3, content = $4, session_date = $5,
           visited_locations = $6, related_events = $7, npcs = $8, updated_at = NOW()
       WHERE id = $1 AND campaign_id = $2
       RETURNING *`,
      [id, campaignId, title, content ?? null, session_date ?? null,
        visited_locations ?? null, related_events ?? null, npcs ?? null]
    );
    return rows[0] || null;
  },

  // Scoped by both id AND campaign_id, same defense-in-depth as
  // campaign-gallery.model.js's remove().
  async remove(id, campaignId) {
    const { rowCount } = await pool.query(
      `DELETE FROM campaigns.campaign_sessions WHERE id = $1 AND campaign_id = $2`,
      [id, campaignId]
    );
    return rowCount > 0;
  },
};

module.exports = CampaignSessionModel;
