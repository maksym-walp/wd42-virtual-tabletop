const pool = require('../config/db');
const crypto = require('crypto');

function generateInviteCode() {
  return crypto.randomBytes(6).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

// invite_code UNIQUE: на рідкісну колізію (23505) пробуємо інший код.
async function withUniqueInviteCode(run) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { rows } = await run(generateInviteCode());
      return rows[0] || null;
    } catch (err) {
      if (err.code === '23505') { lastErr = err; continue; }
      throw err;
    }
  }
  throw lastErr;
}

const CampaignModel = {
  async create(gmId, name) {
    return withUniqueInviteCode((code) => pool.query(
      `INSERT INTO campaigns.campaigns (gm_id, name, invite_code)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [gmId, name, code]
    ));
  },

  async regenerateInviteCode(id) {
    return withUniqueInviteCode((code) => pool.query(
      `UPDATE campaigns.campaigns SET invite_code = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, code]
    ));
  },

  // Joined with the GM's username so every campaign-scoped controller (they
  // all route through loadCampaignOr404 -> findById) gets it for free — the
  // Home tab shows the GM's nickname alongside the campaign description.
  async findById(id) {
    const { rows } = await pool.query(
      `SELECT cp.*, u.username AS gm_username
       FROM campaigns.campaigns cp
       JOIN auth.users u ON u.id = cp.gm_id
       WHERE cp.id = $1`,
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

  // Адмінський огляд: усі кампанії з ніком майстра.
  async findAll() {
    const { rows } = await pool.query(
      `SELECT cp.*, u.username AS gm_username
       FROM campaigns.campaigns cp
       LEFT JOIN auth.users u ON u.id = cp.gm_id
       ORDER BY cp.created_at DESC`
    );
    return rows;
  },

  async updateDescription(id, description) {
    const { rows } = await pool.query(
      `UPDATE campaigns.campaigns SET description = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, description]
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

  async rename(id, name) {
    const { rows } = await pool.query(
      `UPDATE campaigns.campaigns SET name = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, name]
    );
    return rows[0] || null;
  },

  // calendar_id / current_month_id are cross-service refs into the
  // calendar service's schema (calendar.calendars / calendar.calendar_months)
  // — FK-less plain UUID columns, same convention as campaign_characters.character_id.
  // All four fields are set together since a current date only means
  // something relative to the calendar it's set against.
  async updateCurrentDate(id, { calendar_id, current_year, current_month_id, current_day }) {
    const { rows } = await pool.query(
      `UPDATE campaigns.campaigns
       SET calendar_id = $2, current_year = $3, current_month_id = $4, current_day = $5, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, calendar_id ?? null, current_year ?? null, current_month_id ?? null, current_day ?? null]
    );
    return rows[0] || null;
  },

  // campaign_characters rows cascade-delete with the campaign (FK ON DELETE
  // CASCADE); the characters themselves live in character_sheet and are untouched.
  async remove(id) {
    const { rowCount } = await pool.query(
      `DELETE FROM campaigns.campaigns WHERE id = $1`,
      [id]
    );
    return rowCount > 0;
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

  // Cross-schema read (campaigns -> npcs/bestiary) for cloning an NPC or a
  // creature into the combat tracker. Both used to live in one compendium
  // table; ids were preserved by the split, so compendium_entry_id keeps
  // pointing at either one. Visibility mirrors the owning services' rule
  // (own or public, admin sees all) — a GM shouldn't be able to clone
  // another GM's private homebrew monster into their combat.
  // health_die is resolved the same way npcs/bestiary resolve it (own
  // override, else subspecies, else species, else 'd6') — duplicated here
  // since services share no code, only the database.
  // entity_type/rolled_health are read too: an NPC's persisted rolled
  // health is what gets cloned into combat, not a recomputed average —
  // creatures have no persistent health, so rolled_health is null for them.
  async findCompendiumEntry(entryId, userId, isAdmin) {
    const { rows } = await pool.query(
      `SELECT e.id, e.name, e.entity_type, e.dexterity, e.body, e.intelligence, e.wisdom, e.charisma,
              e.rolled_health,
              COALESCE(e.health_die_override, sub.health_die, sp.health_die, 'd6') AS health_die
       FROM (
         SELECT id, name, 'npc'::varchar AS entity_type, dexterity, body, intelligence, wisdom, charisma,
                rolled_health, health_die_override, species_id, subspecies_id, created_by, is_public
         FROM npcs.npcs
         UNION ALL
         SELECT id, name, 'creature'::varchar, dexterity, body, intelligence, wisdom, charisma,
                NULL::smallint, health_die_override, species_id, subspecies_id, created_by, is_public
         FROM bestiary.creatures
       ) e
       LEFT JOIN compendium.species sp ON sp.id = e.species_id
       LEFT JOIN compendium.subspecies sub ON sub.id = e.subspecies_id
       WHERE e.id = $1 AND ($3::bool OR e.created_by = $2 OR e.is_public = true)`,
      [entryId, userId, isAdmin]
    );
    return rows[0] || null;
  },

  // True if userId GMs any campaign this character is currently attached to
  // — mirrors character-sheet's own isCampaignGmForCharacter (which grants
  // the same GM the right to edit that sheet in the first place), so the
  // reverse HP sync back into the combat tracker isn't limited to the
  // character's owner alone.
  async isCampaignGmForCharacter(characterId, userId) {
    const { rows } = await pool.query(
      `SELECT 1
       FROM campaigns.campaign_characters cc
       JOIN campaigns.campaigns cp ON cp.id = cc.campaign_id
       WHERE cc.character_id = $1 AND cp.gm_id = $2
       LIMIT 1`,
      [characterId, userId]
    );
    return rows.length > 0;
  },

  // Кампанії, до яких прикріплено персонажа — кому розіслати real-time
  // подію, коли лист персонажа синхронізує ХП.
  async campaignIdsForCharacter(characterId) {
    const { rows } = await pool.query(
      `SELECT campaign_id FROM campaigns.campaign_characters WHERE character_id = $1`,
      [characterId]
    );
    return rows.map((r) => r.campaign_id);
  },
};

module.exports = CampaignModel;
