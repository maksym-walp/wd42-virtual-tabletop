const pool = require('../config/db');

// Cross-schema check (npcs -> character_sheet/campaigns), mirroring who may
// open a character sheet in character-sheet's getSheet: the owner, anyone for
// a public character, or the GM of a campaign it is attached to. Admins and
// game masters are let through by the controller before this runs.
const CharacterAccessModel = {
  async canView(characterId, userId) {
    const { rows } = await pool.query(
      `SELECT 1
       FROM character_sheet.characters c
       WHERE c.id = $1
         AND (c.user_id = $2 OR c.is_public = true OR EXISTS (
           SELECT 1 FROM campaigns.campaign_characters cc
           JOIN campaigns.campaigns cp ON cp.id = cc.campaign_id
           WHERE cc.character_id = c.id AND cp.gm_id = $2))
       LIMIT 1`,
      [characterId, userId]
    );
    return rows.length > 0;
  },
};

module.exports = CharacterAccessModel;
