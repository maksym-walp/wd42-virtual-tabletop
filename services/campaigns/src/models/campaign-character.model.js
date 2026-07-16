const pool = require('../config/db');

const CampaignCharacterModel = {
  async add(campaignId, characterId) {
    const { rows } = await pool.query(
      `INSERT INTO campaigns.campaign_characters (campaign_id, character_id)
       VALUES ($1, $2)
       ON CONFLICT (campaign_id, character_id) DO NOTHING
       RETURNING *`,
      [campaignId, characterId]
    );
    return rows[0] || null; // null means it was already attached
  },

  // Cross-schema join: campaign_characters -> character_sheet.characters -> auth.users
  async listWithOwners(campaignId) {
    const { rows } = await pool.query(
      `SELECT cc.character_id, cc.added_at,
              c.name AS character_name, c.archetype, c.race, c.user_id AS owner_id,
              u.username AS owner_username, u.email AS owner_email
       FROM campaigns.campaign_characters cc
       JOIN character_sheet.characters c ON c.id = cc.character_id
       JOIN auth.users u ON u.id = c.user_id
       WHERE cc.campaign_id = $1
       ORDER BY cc.added_at ASC`,
      [campaignId]
    );
    return rows;
  },

  // Is this user a member of the campaign (owns >=1 character attached to it)?
  async isMember(campaignId, userId) {
    const { rows } = await pool.query(
      `SELECT 1 FROM campaigns.campaign_characters cc
       JOIN character_sheet.characters c ON c.id = cc.character_id
       WHERE cc.campaign_id = $1 AND c.user_id = $2
       LIMIT 1`,
      [campaignId, userId]
    );
    return rows.length > 0;
  },
};

module.exports = CampaignCharacterModel;
