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

  async add(campaignId, { title, content, session_date }) {
    const { rows } = await pool.query(
      `INSERT INTO campaigns.campaign_sessions (campaign_id, title, content, session_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [campaignId, title, content ?? null, session_date ?? null]
    );
    return rows[0];
  },

  async update(id, campaignId, { title, content, session_date }) {
    const { rows } = await pool.query(
      `UPDATE campaigns.campaign_sessions
       SET title = $3, content = $4, session_date = $5, updated_at = NOW()
       WHERE id = $1 AND campaign_id = $2
       RETURNING *`,
      [id, campaignId, title, content ?? null, session_date ?? null]
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
