const pool = require('../config/db');

// Cross-schema check (maps -> campaigns/character_sheet), mirroring the
// exact membership rule campaigns' own load-campaign.js/isGm and
// CampaignCharacterModel.isMember use: the campaign's GM, or the owner of
// a character attached to it. Used to gate which ?campaign_id a map-pin
// reader may actually use as their "current campaign" — without this,
// anyone could pass an arbitrary campaign_id and see pins scoped to a
// campaign they aren't in.
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
};

module.exports = CampaignMembershipModel;
