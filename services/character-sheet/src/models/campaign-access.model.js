const pool = require('../config/db');

// Cross-schema check (character-sheet -> campaigns), mirroring the existing
// cross-schema convention (see prerequisite.model.js -> spellbook/equipment/abilities).
// True if userId is the GM of ANY campaign this character is currently attached to.
async function isCampaignGmForCharacter(characterId, userId) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM campaigns.campaign_characters cc
     JOIN campaigns.campaigns cp ON cp.id = cc.campaign_id
     WHERE cc.character_id = $1 AND cp.gm_id = $2
     LIMIT 1`,
    [characterId, userId]
  );
  return rows.length > 0;
}

module.exports = { isCampaignGmForCharacter };
