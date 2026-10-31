const pool = require('../config/db');
const { deleteWithTrash } = require('../utils/trash');
const { serializeImageCrop } = require('../utils/image-crop');

const CHILD_TABLES = [
  'skills', 'known_spells', 'tree_progress', 'equipment',
  'ritual_trackers', 'abilities',
];

const ALL_SKILLS = [
  'evasion','acrobatics','stealth','sleight_of_hand',
  'strength','immunity','magic_sense','endurance',
  'history','nature','erudition','mysticism',
  'intuition','spellcasting','cleverness','perception',
  'will','deception','artistry','persuasion',
];

// Підвид (народ) змінює навички дельтою: віднімається знімок бонусів, що вже
// застосований до персонажа (people_bonus), додається бонус нового підвиду.
// І value, і base_value зсуваються разом — досвід рахується від base_value,
// тож бонус підвиду не повинен виглядати як витрачений досвід.
async function applyPeople(client, characterId, peopleId, bonus) {
  const { rows: [current] } = await client.query(
    `SELECT people_bonus FROM character_sheet.characters WHERE id = $1 FOR UPDATE`,
    [characterId]
  );
  if (!current) return null;

  const old = current.people_bonus || {};
  for (const key of new Set([...Object.keys(old), ...Object.keys(bonus)])) {
    const delta = (bonus[key] || 0) - (old[key] || 0);
    if (!delta) continue;
    await client.query(
      `UPDATE character_sheet.skills
       SET value      = GREATEST(1, LEAST(12, value + $3)),
           base_value = GREATEST(1, LEAST(12, base_value + $3))
       WHERE character_id = $1 AND skill_key = $2`,
      [characterId, key, delta]
    );
  }

  const { rows: [character] } = await client.query(
    `UPDATE character_sheet.characters
     SET people_id = $2, people_bonus = $3::jsonb, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [characterId, peopleId, JSON.stringify(bonus)]
  );
  return character;
}

const CharacterModel = {
  // isAdmin lists every user's characters (with owner_username attached so
  // an admin can tell them apart), not just the caller's own.
  // includeGmCampaigns — також персонажі інших гравців з кампаній, де
  // userId є майстром (вкладка "Персонажі"); gm_campaigns — назви таких
  // кампаній для кожного персонажа. Решта викликачів (вибір персонажа для
  // кампанії/фракції) лишаються лише з власними персонажами.
  async findAllByUser(userId, isAdmin = false, { includeGmCampaigns = false } = {}) {
    const { rows } = await pool.query(
      `SELECT c.*, ou.username AS owner_username, (c.user_id = $1) AS is_owner,
        (SELECT rc.name FROM compendium.races rc WHERE rc.id = c.race_id) AS race_name,
        (SELECT COUNT(*) FROM character_sheet.skills WHERE character_id = c.id) AS skill_count,
        COALESCE(
          (SELECT array_agg(cp.name ORDER BY cp.name)
           FROM campaigns.campaign_characters cc
           JOIN campaigns.campaigns cp ON cp.id = cc.campaign_id
           WHERE cc.character_id = c.id AND cp.gm_id = $1),
          '{}'
        ) AS gm_campaigns
       FROM character_sheet.characters c
       LEFT JOIN auth.users ou ON ou.id = c.user_id
       WHERE c.user_id = $1 OR $2 = true
          OR ($3 = true AND EXISTS (
            SELECT 1 FROM campaigns.campaign_characters cc
            JOIN campaigns.campaigns cp ON cp.id = cc.campaign_id
            WHERE cc.character_id = c.id AND cp.gm_id = $1))
       ORDER BY c.created_at DESC`,
      [userId, isAdmin, includeGmCampaigns]
    );
    return rows;
  },

  // people_name/people_description — підвид (народ) з компендіуму: лист
  // показує його й гостям, яким конфіг підвидів (GET /config) недоступний.
  async findById(id) {
    const { rows } = await pool.query(
      `SELECT c.*, cp.name AS people_name, cp.description AS people_description,
              (SELECT rc.name FROM compendium.races rc WHERE rc.id = c.race_id) AS race_name
       FROM character_sheet.characters c
       LEFT JOIN compendium.peoples cp ON cp.id = c.people_id
       WHERE c.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  // Public characters authored by other, non-admin users — used by the
  // Dashboard's "Творіння спільноти" rail.
  async findAllPublic(userId, { limit = 15 } = {}) {
    const { rows } = await pool.query(
      `SELECT c.*, ou.username AS owner_username, (SELECT rc.name FROM compendium.races rc WHERE rc.id = c.race_id) AS race_name
       FROM character_sheet.characters c
       LEFT JOIN auth.users ou ON ou.id = c.user_id
       WHERE c.is_public = true AND c.user_id <> $1 AND ou.role IS DISTINCT FROM 'admin'
       ORDER BY c.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return rows;
  },

  async findPublicById(id) {
    const { rows } = await pool.query(
      `SELECT c.*, cp.name AS people_name, cp.description AS people_description,
              (SELECT rc.name FROM compendium.races rc WHERE rc.id = c.race_id) AS race_name
       FROM character_sheet.characters c
       LEFT JOIN compendium.peoples cp ON cp.id = c.people_id AND cp.is_public = true
       WHERE c.id = $1 AND c.is_public = true`,
      [id]
    );
    return rows[0] || null;
  },

  // Cross-schema lookup (character-sheet -> auth), mirroring the existing
  // convention (e.g. campaigns service -> character_sheet/auth).
  async findOwnerUsername(userId) {
    const { rows } = await pool.query(
      `SELECT username FROM auth.users WHERE id = $1`,
      [userId]
    );
    return rows[0]?.username ?? null;
  },

  // raceId/peopleId/peopleBonus (раса й підвид) уже перевірені контролером проти
  // конфігу адміна (race — compendium.races; старе поле race нових персонажів
  // порожнє).
  // адміна. Без явних skills навички стартують з 1 + бонус підвиду; крок 2
  // візарда все одно перезаписує їх власними значеннями.
  async create(userId, { name, archetype, raceId, skills, peopleId = null, peopleBonus = {} }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO character_sheet.characters (user_id, name, archetype, race_id, people_id, people_bonus)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING *`,
        [userId, name, archetype, raceId, peopleId, JSON.stringify(peopleBonus)]
      );
      const character = rows[0];

      // Insert all 20 skills with provided values (or default 1 + people bonus)
      const skillValues = ALL_SKILLS.map(key => ({
        key,
        value: skills?.[key] ?? 1 + (peopleBonus[key] || 0),
      }));

      for (const s of skillValues) {
        await client.query(
          `INSERT INTO character_sheet.skills (character_id, skill_key, value, base_value)
           VALUES ($1, $2, $3, $3)`,
          [character.id, s.key, Math.max(1, Math.min(12, s.value))]
        );
      }

      // Auto-unlock root nodes matching the character's archetype
      await client.query(
        `INSERT INTO character_sheet.tree_progress (character_id, node_id)
         SELECT $1, n.id
         FROM skill_tree.nodes n
         WHERE n.is_root = true
           AND (array_length(n.archetypes, 1) IS NULL OR $2 = ANY(n.archetypes))
         ON CONFLICT (character_id, node_id) DO NOTHING`,
        [character.id, archetype]
      );

      await client.query('COMMIT');
      return character;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Authorization (owner or campaign GM) is fully resolved by the controller
  // (authorizeCharacterWrite) before this is called, so no user_id gate here —
  // same convention as every child-table model (skill.model.js, equipment.model.js, ...).
  async update(id, data) {
    const {
      name, is_public, backstory, notes,
      current_hp, current_magic, heroic_actions_used,
      death_scale, health_dice_values, conditions, experience_points, money,
      spell_bonus, temp_hp, defense_bonus, inspiration_used, narrative_inspiration_die,
      luck_current, luck_max, rogue_inspiration_die, rogue_inspiration_given_to,
      image_url, image_crop,
    } = data;

    // death_scale/narrative_inspiration_die/rogue_inspiration_* use a
    // CASE/flag because NULL is itself a valid target value (no stage
    // selected / no die granted / not yet given to anyone)
    const setDeathScale = 'death_scale' in data;
    const setNarrativeDie = 'narrative_inspiration_die' in data;
    const setRogueDie = 'rogue_inspiration_die' in data;
    const setRogueGivenTo = 'rogue_inspiration_given_to' in data;
    // image_url joins them: NULL means "no portrait", so COALESCE would make
    // removing a portrait impossible (null would read as "leave unchanged").
    const setImageUrl = 'image_url' in data;
    // Кадр портрета (див. utils/image-crop.js) — так само через прапорець, бо
    // NULL означає «показ по центру». Нове зображення без кадру скидає старий
    // кадр: він рахувався під інші пропорції.
    const setImageCrop = 'image_crop' in data || setImageUrl;

    const { rows } = await pool.query(
      `UPDATE character_sheet.characters
       SET name                = COALESCE($2, name),
           is_public           = COALESCE($3, is_public),
           backstory           = COALESCE($4, backstory),
           notes               = COALESCE($5, notes),
           current_hp          = COALESCE($6, current_hp),
           current_magic       = COALESCE($7, current_magic),
           heroic_actions_used = COALESCE($8, heroic_actions_used),
           death_scale         = CASE WHEN $9 THEN $10::smallint ELSE death_scale END,
           health_dice_values  = COALESCE($11::integer[], health_dice_values),
           conditions          = COALESCE($12::jsonb, conditions),
           experience_points   = COALESCE($13, experience_points),
           money               = COALESCE($14::jsonb, money),
           spell_bonus         = COALESCE($15, spell_bonus),
           temp_hp             = COALESCE($16, temp_hp),
           defense_bonus       = COALESCE($17, defense_bonus),
           inspiration_used    = COALESCE($18, inspiration_used),
           narrative_inspiration_die = CASE WHEN $19 THEN $20 ELSE narrative_inspiration_die END,
           luck_current        = COALESCE($21, luck_current),
           luck_max            = COALESCE($22, luck_max),
           rogue_inspiration_die      = CASE WHEN $23 THEN $24 ELSE rogue_inspiration_die END,
           rogue_inspiration_given_to = CASE WHEN $25 THEN $26 ELSE rogue_inspiration_given_to END,
           image_url           = CASE WHEN $27 THEN $28 ELSE image_url END,
           image_crop          = CASE WHEN $29 THEN $30::jsonb ELSE image_crop END,
           updated_at          = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        name ?? null, is_public ?? null, backstory ?? null, notes ?? null,
        current_hp ?? null, current_magic ?? null, heroic_actions_used ?? null,
        setDeathScale, setDeathScale ? (death_scale ?? null) : null,
        health_dice_values ?? null,
        conditions ? JSON.stringify(conditions) : null,
        experience_points ?? null,
        money ? JSON.stringify(money) : null,
        spell_bonus ?? null,
        temp_hp ?? null,
        defense_bonus ?? null,
        inspiration_used ?? null,
        setNarrativeDie, setNarrativeDie ? (narrative_inspiration_die ?? null) : null,
        luck_current ?? null,
        luck_max ?? null,
        setRogueDie, setRogueDie ? (rogue_inspiration_die ?? null) : null,
        setRogueGivenTo, setRogueGivenTo ? (rogue_inspiration_given_to ?? null) : null,
        setImageUrl, setImageUrl ? (image_url ?? null) : null,
        setImageCrop, setImageCrop && !(setImageUrl && !image_url) ? serializeImageCrop(image_crop) : null,
      ]
    );
    return rows[0] || null;
  },

  // Задає/знімає підвид (peopleId = null знімає). Контролер уже перевірив,
  // що народ відкритий адміном для раси персонажа, і передав його бонус.
  // Повертає { character, skills } — навички змінились разом із підвидом.
  async setPeople(id, peopleId, bonus = {}) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const character = await applyPeople(client, id, peopleId, peopleId ? bonus : {});
      if (!character) { await client.query('ROLLBACK'); return null; }
      const { rows: skills } = await client.query(
        `SELECT * FROM character_sheet.skills WHERE character_id = $1 ORDER BY skill_key`,
        [id]
      );
      await client.query('COMMIT');
      return { character, skills };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Admin-only — reassigns the character to another registered user.
  async setOwner(id, ownerUsername) {
    const { rows } = await pool.query(
      `UPDATE character_sheet.characters
       SET user_id = (SELECT id FROM auth.users WHERE username = $2), updated_at = NOW()
       WHERE id = $1 AND EXISTS (SELECT 1 FROM auth.users WHERE username = $2)
       RETURNING *`,
      [id, ownerUsername]
    );
    return rows[0] || null;
  },

  // Copies a character for a new race/archetype combination. skills and
  // equipment aren't archetype-specific, so they always carry over; tree_progress/
  // known_spells/abilities/ritual_trackers are only reachable through the skill
  // tree (applyGrants in tree-progress.model.js, plus the archetype-tab ritual
  // trackers), so they only carry over when the archetype is unchanged — a real
  // archetype change intentionally leaves the duplicate's tree untouched rather
  // than auto-unlocking roots the way create() does.
  async duplicate(sourceId, { name, archetype, raceId }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [source] } = await client.query(
        `SELECT * FROM character_sheet.characters WHERE id = $1`,
        [sourceId]
      );
      if (!source) { await client.query('ROLLBACK'); return null; }

      const newArchetype = archetype ?? source.archetype;
      // Нова раса — завжди раса компендіуму; без неї копія лишає расу джерела
      // (разом зі старим ключем race у ще не зіставлених персонажів).
      const newRaceId = raceId ?? source.race_id;
      const raceChanged = newRaceId !== source.race_id;
      const sameArchetype = newArchetype === source.archetype;

      const { rows: [copy] } = await client.query(
        `INSERT INTO character_sheet.characters
           (user_id, name, archetype, race, race_id, is_public, backstory, notes,
            current_hp, current_magic, heroic_actions_used, death_scale,
            health_dice_values, conditions, experience_points, money,
            spell_bonus, temp_hp, defense_bonus, inspiration_used,
            narrative_inspiration_die, luck_current, luck_max,
            rogue_inspiration_die, rogue_inspiration_given_to, image_url, image_crop,
            people_id, people_bonus)
         SELECT user_id, $2, $3, CASE WHEN $5::boolean THEN NULL ELSE race END, $4::uuid, is_public, backstory, notes,
                current_hp, current_magic, heroic_actions_used, death_scale,
                health_dice_values, conditions, experience_points, money,
                spell_bonus, temp_hp, defense_bonus, inspiration_used,
                narrative_inspiration_die, luck_current, luck_max,
                rogue_inspiration_die, rogue_inspiration_given_to, image_url, image_crop,
                people_id, people_bonus
         FROM character_sheet.characters WHERE id = $1
         RETURNING *`,
        [sourceId, name ?? source.name, newArchetype, newRaceId, raceChanged]
      );

      await client.query(
        `INSERT INTO character_sheet.skills (character_id, skill_key, value, base_value, progress_marks)
         SELECT $2, skill_key, value, base_value, progress_marks
         FROM character_sheet.skills WHERE character_id = $1`,
        [sourceId, copy.id]
      );
      // Підвид відкривається адміном для конкретної раси: з іншою расою він
      // не діє, тож знімаємо його разом з бонусом, що вже в скопійованих навичках.
      if (raceChanged && source.people_id) {
        await applyPeople(client, copy.id, null, {});
      }
      await client.query(
        `INSERT INTO character_sheet.equipment (character_id, equipment_id, mastered, is_equipped)
         SELECT $2, equipment_id, mastered, is_equipped
         FROM character_sheet.equipment WHERE character_id = $1`,
        [sourceId, copy.id]
      );

      if (sameArchetype) {
        await client.query(
          `INSERT INTO character_sheet.tree_progress (character_id, node_id, unlocked_at)
           SELECT $2, node_id, unlocked_at
           FROM character_sheet.tree_progress WHERE character_id = $1`,
          [sourceId, copy.id]
        );
        await client.query(
          `INSERT INTO character_sheet.known_spells (character_id, spell_id, mastered, cast_count, form_tier, primary_form, mastered_forms, gm_granted)
           SELECT $2, spell_id, mastered, cast_count, form_tier, primary_form, mastered_forms, gm_granted
           FROM character_sheet.known_spells WHERE character_id = $1`,
          [sourceId, copy.id]
        );
        await client.query(
          `INSERT INTO character_sheet.abilities (character_id, ability_id, form_tier, primary_form, mastered_forms)
           SELECT $2, ability_id, form_tier, primary_form, mastered_forms
           FROM character_sheet.abilities WHERE character_id = $1`,
          [sourceId, copy.id]
        );
        await client.query(
          `INSERT INTO character_sheet.ritual_trackers (character_id, name, rounds, participants)
           SELECT $2, name, rounds, participants
           FROM character_sheet.ritual_trackers WHERE character_id = $1`,
          [sourceId, copy.id]
        );
      }

      await client.query('COMMIT');
      return copy;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async delete(id, deletedBy = null) {
    const record = await deleteWithTrash(pool, {
      schemaName: 'character_sheet',
      tableName: 'characters',
      deleteQuery: `DELETE FROM character_sheet.characters WHERE id = $1 RETURNING *`,
      deleteParams: [id],
      childQueries: CHILD_TABLES.map((table) => ({
        key: table,
        sql: `SELECT * FROM character_sheet.${table} WHERE character_id = $1`,
        params: [id],
      })),
      deletedBy,
    });
    return !!record;
  },
};

module.exports = CharacterModel;
