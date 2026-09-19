const pool = require('../config/db');

// Cross-schema check (maps -> campaigns/character_sheet), mirroring the
// exact membership rule campaigns' own load-campaign.js/isGm and
// CampaignCharacterModel.isMember use: the campaign's GM, or the owner of
// a character attached to it.
const CampaignMembershipModel = {
  async isMember(campaignId, userId) {
    const { rows } = await pool.query(
      `SELECT 1
       FROM campaigns.campaigns cp
       LEFT JOIN campaigns.campaign_characters cc ON cc.campaign_id = cp.id
       LEFT JOIN character_sheet.characters c ON c.id = cc.character_id
       WHERE cp.id = $1 AND (cp.gm_id = $2 OR c.user_id = $2)
       LIMIT 1`,
      [campaignId, userId]
    );
    return rows.length > 0;
  },

  // Every campaign this map is linked to (campaigns.campaign_maps) that the
  // user is a member of (GM, or owner of a character attached to it) — the
  // "current campaign" context is derived server-side from this instead of
  // trusting a client-supplied ?campaign_id, so a pin scoped to a campaign
  // reads the same way on a refresh, a bare/shared map link, or the
  // campaign page — not only when the campaign_id happened to be in the URL.
  async memberCampaignIdsForMap(mapId, userId) {
    const { rows } = await pool.query(
      `SELECT DISTINCT cm.campaign_id
       FROM campaigns.campaign_maps cm
       JOIN campaigns.campaigns cp ON cp.id = cm.campaign_id
       LEFT JOIN campaigns.campaign_characters cc ON cc.campaign_id = cp.id
       LEFT JOIN character_sheet.characters c ON c.id = cc.character_id
       WHERE cm.map_id = $1 AND (cp.gm_id = $2 OR c.user_id = $2)`,
      [mapId, userId]
    );
    return rows.map((r) => r.campaign_id);
  },
};

module.exports = CampaignMembershipModel;
