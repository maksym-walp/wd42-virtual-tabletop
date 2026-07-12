const pool = require('../config/db');

const ALL_SKILLS = [
  'evasion','acrobatics','stealth','sleight_of_hand',
  'strength','immunity','magic_sense','endurance',
  'history','nature','erudition','mysticism',
  'intuition','spellcasting','cleverness','perception',
  'will','deception','artistry','persuasion',
];

const CharacterModel = {
  async findAllByUser(userId) {
    const { rows } = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM character_sheet.skills WHERE character_id = c.id) AS skill_count
       FROM character_sheet.characters c
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT * FROM character_sheet.characters WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findPublicById(id) {
    const { rows } = await pool.query(
      `SELECT * FROM character_sheet.characters WHERE id = $1 AND is_public = true`,
      [id]
    );
    return rows[0] || null;
  },

  async create(userId, { name, archetype, race, race_ancestry, skills }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO character_sheet.characters (user_id, name, archetype, race, race_ancestry)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, name, archetype, race, race_ancestry ?? null]
      );
      const character = rows[0];

      // Insert all 20 skills with provided values (or default 1)
      const skillValues = ALL_SKILLS.map(key => ({
        key,
        value: skills?.[key] ?? 1,
      }));

      for (const s of skillValues) {
        await client.query(
          `INSERT INTO character_sheet.skills (character_id, skill_key, value)
           VALUES ($1, $2, $3)`,
          [character.id, s.key, Math.max(1, Math.min(12, s.value))]
        );
      }

      // Auto-unlock root nodes matching the character's archetype and race
      await client.query(
        `INSERT INTO character_sheet.tree_progress (character_id, node_id)
         SELECT $1, n.id
         FROM skill_tree.nodes n
         WHERE n.is_root = true
           AND (array_length(n.archetypes, 1) IS NULL OR $2 = ANY(n.archetypes))
           AND (array_length(n.races, 1) IS NULL OR $3 = ANY(n.races))
         ON CONFLICT (character_id, node_id) DO NOTHING`,
        [character.id, archetype, race]
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

  async update(id, userId, data) {
    const {
      name, is_public, backstory, notes,
      current_hp, current_magic, heroic_actions_used,
      death_scale, health_dice_values, conditions, dev_points, money,
      spell_bonus, temp_hp, defense_bonus, inspiration_used, narrative_inspiration_die,
      luck_current, luck_max, rogue_inspiration_die, rogue_inspiration_given_to,
    } = data;

    // death_scale/narrative_inspiration_die/rogue_inspiration_* use a
    // CASE/flag because NULL is itself a valid target value (no stage
    // selected / no die granted / not yet given to anyone)
    const setDeathScale = 'death_scale' in data;
    const setNarrativeDie = 'narrative_inspiration_die' in data;
    const setRogueDie = 'rogue_inspiration_die' in data;
    const setRogueGivenTo = 'rogue_inspiration_given_to' in data;

    const { rows } = await pool.query(
      `UPDATE character_sheet.characters
       SET name                = COALESCE($3, name),
           is_public           = COALESCE($4, is_public),
           backstory           = COALESCE($5, backstory),
           notes               = COALESCE($6, notes),
           current_hp          = COALESCE($7, current_hp),
           current_magic       = COALESCE($8, current_magic),
           heroic_actions_used = COALESCE($9, heroic_actions_used),
           death_scale         = CASE WHEN $10 THEN $11::smallint ELSE death_scale END,
           health_dice_values  = COALESCE($12::integer[], health_dice_values),
           conditions          = COALESCE($13::jsonb, conditions),
           dev_points          = COALESCE($14, dev_points),
           money               = COALESCE($15::jsonb, money),
           spell_bonus         = COALESCE($16, spell_bonus),
           temp_hp             = COALESCE($17, temp_hp),
           defense_bonus       = COALESCE($18, defense_bonus),
           inspiration_used    = COALESCE($19, inspiration_used),
           narrative_inspiration_die = CASE WHEN $20 THEN $21 ELSE narrative_inspiration_die END,
           luck_current        = COALESCE($22, luck_current),
           luck_max            = COALESCE($23, luck_max),
           rogue_inspiration_die      = CASE WHEN $24 THEN $25 ELSE rogue_inspiration_die END,
           rogue_inspiration_given_to = CASE WHEN $26 THEN $27 ELSE rogue_inspiration_given_to END,
           updated_at          = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        id, userId,
        name ?? null, is_public ?? null, backstory ?? null, notes ?? null,
        current_hp ?? null, current_magic ?? null, heroic_actions_used ?? null,
        setDeathScale, setDeathScale ? (death_scale ?? null) : null,
        health_dice_values ?? null,
        conditions ? JSON.stringify(conditions) : null,
        dev_points ?? null,
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
      ]
    );
    return rows[0] || null;
  },

  async delete(id, userId) {
    const { rowCount } = await pool.query(
      `DELETE FROM character_sheet.characters WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return rowCount > 0;
  },
};

module.exports = CharacterModel;
