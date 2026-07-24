const pool = require('../config/db');

const SORT_MAP = {
  name:        's.name ASC',
  action_time: 's.action_time ASC, s.name ASC',
  energy_cost: 's.energy_cost ASC, s.name ASC',
};

const prereqNodesSelect = (alias) => `COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title) ORDER BY n.title)
     FROM skill_tree.nodes n WHERE n.id = ANY(${alias}.prerequisite_node_ids)),
    '[]'::jsonb
  ) AS prerequisite_nodes`;

const traditionsSelect = (alias) => `COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
     FROM spellbook.tradition_spells ts
     JOIN spellbook.traditions t ON t.id = ts.tradition_id
     WHERE ts.spell_id = ${alias}.id),
    '[]'::jsonb
  ) AS traditions`;

// Canonical = authored by an admin/game_master, or explicitly flagged via the
// "Зробити канонічним" action (s.is_canonical) regardless of owner.
const IS_CANONICAL_EXPR = "(COALESCE(cu.role IN ('admin', 'game_master'), false) OR s.is_canonical)";

const SpellModel = {
  async findAll(userId, { nature, spellKind, ritual, search, sort, scope, limit, traditionId } = {}, isAdmin = false) {
    const params = [userId];
    // scope=community = public entries authored by other, non-canonical users
    // (used by the Dashboard's "Творіння спільноти" rail) — replaces the
    // default ownership clause instead of appending to it.
    const conditions = scope === 'community'
      ? ['s.is_public = true', 's.user_id <> $1', `NOT ${IS_CANONICAL_EXPR}`]
      : [isAdmin ? 'TRUE' : '(s.user_id = $1 OR s.is_public = true)'];

    if (scope === 'canonical') conditions.push(IS_CANONICAL_EXPR);
    else if (scope === 'user') conditions.push(`NOT ${IS_CANONICAL_EXPR}`);

    // nature/traditionId each accept either a single value or an array (a
    // repeated query param like ?nature=a&nature=b arrives as an array via
    // Express's qs parser) — multiple selected values are OR'd together.
    if (nature) {
      const natureArr = Array.isArray(nature) ? nature : [nature];
      params.push(natureArr);
      conditions.push(`s.nature && $${params.length}::text[]`);
    }
    if (spellKind) {
      params.push(spellKind);
      conditions.push(`s.spell_kind = $${params.length}`);
    }
    if (ritual) {
      params.push(ritual);
      conditions.push(`s.ritual = $${params.length}`);
    }
    if (traditionId) {
      const traditionArr = Array.isArray(traditionId) ? traditionId : [traditionId];
      params.push(traditionArr);
      conditions.push(`EXISTS (SELECT 1 FROM spellbook.tradition_spells ts WHERE ts.spell_id = s.id AND ts.tradition_id = ANY($${params.length}::uuid[]))`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`s.name ILIKE $${params.length}`);
    }

    const orderBy = SORT_MAP[sort] || SORT_MAP.name;

    let limitClause = '';
    if (limit) {
      params.push(limit);
      limitClause = ` LIMIT $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT s.*, (s.user_id = $1) AS is_owner, ${prereqNodesSelect('s')},
              ${traditionsSelect('s')},
              ${IS_CANONICAL_EXPR} AS is_canonical, cu.username AS owner_username
       FROM spellbook.spells s
       LEFT JOIN auth.users cu ON cu.id = s.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}${limitClause}`,
      params
    );
    return rows;
  },

  async findById(id, userId, isAdmin = false) {
    const visibility = isAdmin ? 'TRUE' : '(s.user_id = $2 OR s.is_public = true)';
    const { rows } = await pool.query(
      `SELECT s.*, (s.user_id = $2) AS is_owner, ${prereqNodesSelect('s')},
              ${traditionsSelect('s')},
              ${IS_CANONICAL_EXPR} AS is_canonical, cu.username AS owner_username
       FROM spellbook.spells s
       LEFT JOIN auth.users cu ON cu.id = s.user_id
       WHERE s.id = $1 AND ${visibility}`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const {
      name, nature, spell_kind, mechanical_desc, narrative_desc,
      energy_cost, action_time, ritual,
      duration_value, duration_unit, range_desc,
      components, is_public,
      prerequisite_node_ids, prerequisite_logic, image_url,
      lore_creator,
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO spellbook.spells
         (user_id, name, nature, spell_kind, mechanical_desc, narrative_desc,
          energy_cost, action_time, ritual, duration_value, duration_unit,
          range_desc, components, is_public, prerequisite_node_ids, prerequisite_logic,
          image_url, lore_creator)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        userId, name, nature ?? [], spell_kind ?? 'utility',
        mechanical_desc, narrative_desc,
        energy_cost ?? 0, action_time ?? 1, ritual ?? 'impossible',
        duration_value ?? null, duration_unit ?? 'instant',
        range_desc ?? null, JSON.stringify(components ?? []), is_public ?? false,
        prerequisite_node_ids ?? [], prerequisite_logic ?? 'or',
        image_url ?? null, lore_creator ?? null,
      ]
    );
    return rows[0];
  },

  async update(id, userId, data, isAdmin = false) {
    const {
      name, nature, spell_kind, mechanical_desc, narrative_desc,
      energy_cost, action_time, ritual,
      duration_value, duration_unit, range_desc,
      components, is_public,
      prerequisite_node_ids, prerequisite_logic, image_url,
      lore_creator,
    } = data;

    const { rows } = await pool.query(
      `UPDATE spellbook.spells
       SET name=$3, nature=$4, spell_kind=$5,
           mechanical_desc=$6, narrative_desc=$7,
           energy_cost=$8, action_time=$9, ritual=$10,
           duration_value=$11, duration_unit=$12, range_desc=$13,
           components=$14::jsonb, is_public=$15,
           prerequisite_node_ids=$16, prerequisite_logic=$17,
           image_url=$18, lore_creator=$19, updated_at=NOW()
       WHERE id=$1 AND (user_id=$2 OR $20 = true)
       RETURNING *`,
      [
        id, userId, name, nature ?? [], spell_kind ?? 'utility',
        mechanical_desc, narrative_desc,
        energy_cost, action_time, ritual,
        duration_value ?? null, duration_unit, range_desc ?? null,
        JSON.stringify(components ?? []), is_public ?? false,
        prerequisite_node_ids ?? [], prerequisite_logic ?? 'or',
        image_url ?? null, lore_creator ?? null, isAdmin,
      ]
    );
    return rows[0] || null;
  },

  async delete(id, userId, isAdmin = false) {
    const { rowCount } = await pool.query(
      `DELETE FROM spellbook.spells WHERE id = $1 AND (user_id = $2 OR $3 = true)`,
      [id, userId, isAdmin]
    );
    return rowCount > 0;
  },

  // GM/admin only — flags a spell canonical regardless of who owns it.
  async setCanonical(id, isCanonical) {
    const { rows } = await pool.query(
      `UPDATE spellbook.spells SET is_canonical=$2, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, isCanonical]
    );
    return rows[0] || null;
  },
};

module.exports = SpellModel;
