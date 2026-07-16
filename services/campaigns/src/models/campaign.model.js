const pool = require('../config/db');
const crypto = require('crypto');

function generateInviteCode() {
  return crypto.randomBytes(6).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

const CampaignModel = {
  async create(gmId, name) {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO campaigns.campaigns (gm_id, name, invite_code)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [gmId, name, generateInviteCode()]
        );
        return rows[0];
      } catch (err) {
        if (err.code === '23505') { lastErr = err; continue; }
        throw err;
      }
    }
    throw lastErr;
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT * FROM campaigns.campaigns WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByInviteCode(inviteCode) {
    const { rows } = await pool.query(
      `SELECT * FROM campaigns.campaigns WHERE invite_code = $1`,
      [inviteCode]
    );
    return rows[0] || null;
  },

  async findByGm(gmId) {
    const { rows } = await pool.query(
      `SELECT * FROM campaigns.campaigns WHERE gm_id = $1 ORDER BY created_at DESC`,
      [gmId]
    );
    return rows;
  },

  // Campaigns the user is part of: as GM, or as the owner of an attached
  // character (joined via invite code or added by the GM).
  async findAllForUser(userId) {
    const { rows } = await pool.query(
      `SELECT DISTINCT cp.*, (cp.gm_id = $1) AS is_gm
       FROM campaigns.campaigns cp
       LEFT JOIN campaigns.campaign_characters cc ON cc.campaign_id = cp.id
       LEFT JOIN character_sheet.characters c ON c.id = cc.character_id
       WHERE cp.gm_id = $1 OR c.user_id = $1
       ORDER BY cp.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async updateSharedNotes(id, sharedNotes) {
    const { rows } = await pool.query(
      `UPDATE campaigns.campaigns SET shared_notes = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, sharedNotes]
    );
    return rows[0] || null;
  },

  async updateGmNotes(id, gmNotes) {
    const { rows } = await pool.query(
      `UPDATE campaigns.campaigns SET gm_notes = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, gmNotes]
    );
    return rows[0] || null;
  },

  // Cross-schema check (campaigns -> character_sheet), mirroring the
  // existing cross-schema convention used by character-sheet itself
  // (e.g. prerequisite.model.js -> spellbook/equipment/abilities).
  async findCharacterOwner(characterId) {
    const { rows } = await pool.query(
      `SELECT id, user_id FROM character_sheet.characters WHERE id = $1`,
      [characterId]
    );
    return rows[0] || null;
  },
};

module.exports = CampaignModel;
