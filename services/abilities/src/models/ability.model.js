const pool = require('../config/db');
const { deleteWithTrash } = require('../utils/trash');

const SORT_MAP = {
  name: 'a.name ASC',
};

const prereqNodesSelect = (alias) => `COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title) ORDER BY n.title)
     FROM skill_tree.nodes n WHERE n.id = ANY(${alias}.prerequisite_node_ids)),
    '[]'::jsonb
  ) AS prerequisite_nodes`;

// Canonical = authored by an admin/game_master, or explicitly flagged via the
// "Зробити канонічним" action (a.is_canonical) regardless of owner.
const IS_CANONICAL_EXPR = "(COALESCE(cu.role IN ('admin', 'game_master'), false) OR a.is_canonical)";

const AbilityModel = {
  async findAll(userId, { search, sort, archetype, scope, limit, is_maneuver } = {}, isAdmin = false) {
    const params = [userId];
    // scope=community = public entries authored by other, non-canonical users
    // (used by the Dashboard's "Творіння спільноти" rail) — replaces the
    // default ownership clause instead of appending to it.
    const conditions = scope === 'community'
      ? ['a.is_public = true', 'a.user_id <> $1', `NOT ${IS_CANONICAL_EXPR}`]
      : [isAdmin ? 'TRUE' : '(a.user_id = $1 OR a.is_public = true)'];

    if (scope === 'canonical') conditions.push(IS_CANONICAL_EXPR);
    else if (scope === 'user') conditions.push(`NOT ${IS_CANONICAL_EXPR}`);

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`a.name ILIKE $${params.length}`);
    }
    if (archetype) {
      params.push(archetype);
      conditions.push(`$${params.length} = ANY(a.archetypes)`);
    }
    // is_maneuver arrives as the string 'true'/'false' from a query param —
    // any other value (including '' / undefined) leaves the filter off.
    if (is_maneuver === 'true' || is_maneuver === true) {
      conditions.push('a.is_maneuver = true');
    } else if (is_maneuver === 'false' || is_maneuver === false) {
      conditions.push('a.is_maneuver = false');
    }

    const orderBy = SORT_MAP[sort] || SORT_MAP.name;

    let limitClause = '';
    if (limit) {
      params.push(limit);
      limitClause = ` LIMIT $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT a.*, (a.user_id = $1) AS is_owner, ${prereqNodesSelect('a')},
              ${IS_CANONICAL_EXPR} AS is_canonical, cu.username AS owner_username
       FROM abilities.entries a
       LEFT JOIN auth.users cu ON cu.id = a.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}${limitClause}`,
      params
    );
    return rows;
  },

  async findById(id, userId, isAdmin = false) {
    const visibility = isAdmin ? 'TRUE' : '(a.user_id = $2 OR a.is_public = true)';
    const { rows } = await pool.query(
      `SELECT a.*, (a.user_id = $2) AS is_owner, ${prereqNodesSelect('a')},
              ${IS_CANONICAL_EXPR} AS is_canonical, cu.username AS owner_username
       FROM abilities.entries a
       LEFT JOIN auth.users cu ON cu.id = a.user_id
       WHERE a.id = $1 AND ${visibility}`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const {
      name, archetypes, mechanical_desc, narrative_desc, is_public, prerequisite_node_ids, prerequisite_logic, image_url,
      is_maneuver, duration_value, duration_unit, lore_creator, lore_creator_npc_id,
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO abilities.entries
         (user_id, name, archetypes, mechanical_desc, narrative_desc, is_public, prerequisite_node_ids, prerequisite_logic, image_url,
          is_maneuver, duration_value, duration_unit, lore_creator, lore_creator_npc_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        userId, name, archetypes ?? [], mechanical_desc ?? null, narrative_desc ?? null, is_public ?? false, prerequisite_node_ids ?? [], prerequisite_logic ?? 'or', image_url ?? null,
        is_maneuver ?? false, duration_value ?? null, duration_unit ?? 'instant', lore_creator ?? null, lore_creator_npc_id ?? null,
      ]
    );
    return rows[0];
  },

  async update(id, userId, data, isAdmin = false) {
    const {
      name, archetypes, mechanical_desc, narrative_desc, is_public, prerequisite_node_ids, prerequisite_logic, image_url,
      is_maneuver, duration_value, duration_unit, lore_creator, lore_creator_npc_id,
    } = data;

    const { rows } = await pool.query(
      `UPDATE abilities.entries
       SET name=$3, archetypes=$4, mechanical_desc=$5, narrative_desc=$6, is_public=$7,
           prerequisite_node_ids=$8, prerequisite_logic=$9, image_url=$10,
           is_maneuver=$11, duration_value=$12, duration_unit=$13,
           lore_creator=$14, lore_creator_npc_id=$15, updated_at=NOW()
       WHERE id=$1 AND (user_id=$2 OR $16 = true)
       RETURNING *`,
      [
        id, userId, name, archetypes ?? [], mechanical_desc ?? null, narrative_desc ?? null, is_public ?? false, prerequisite_node_ids ?? [], prerequisite_logic ?? 'or', image_url ?? null,
        is_maneuver ?? false, duration_value ?? null, duration_unit ?? 'instant', lore_creator ?? null, lore_creator_npc_id ?? null, isAdmin,
      ]
    );
    return rows[0] || null;
  },

  async delete(id, userId, isAdmin = false) {
    const record = await deleteWithTrash(pool, {
      schemaName: 'abilities',
      tableName: 'entries',
      deleteQuery: `DELETE FROM abilities.entries WHERE id = $1 AND (user_id = $2 OR $3 = true) RETURNING *`,
      deleteParams: [id, userId, isAdmin],
      childQueries: [
        { key: 'collection_items', sql: `SELECT * FROM abilities.collection_items WHERE ability_id = $1`, params: [id] },
      ],
      deletedBy: userId,
    });
    return !!record;
  },

  // GM/admin only — flags an ability canonical regardless of who owns it.
  async setCanonical(id, isCanonical) {
    const { rows } = await pool.query(
      `UPDATE abilities.entries SET is_canonical=$2, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, isCanonical]
    );
    return rows[0] || null;
  },

  // Admin only — reassign owner by username; EXISTS guards against a typo'd
  // username silently no-oping instead of erroring.
  async setOwner(id, ownerUsername) {
    const { rows } = await pool.query(
      `UPDATE abilities.entries
       SET user_id = (SELECT id FROM auth.users WHERE username = $2), updated_at = NOW()
       WHERE id = $1 AND EXISTS (SELECT 1 FROM auth.users WHERE username = $2)
       RETURNING *`,
      [id, ownerUsername]
    );
    return rows[0] || null;
  },

  // Bulk import previously exported abilities: a single table, so no kind
  // grouping like equipment's union — one multi-row INSERT for the whole
  // batch. Rows with no name are skipped (name is required). user_id is
  // forced to the importer; prerequisite_node_ids/prerequisite_logic,
  // is_canonical, and image_url are deliberately left off the write-column
  // list so they take their table defaults instead of trusting the file —
  // prerequisite node ids belong to a specific user's skill tree and are
  // meaningless to a different importer.
  async bulkImport(userId, records) {
    const valid = records.filter((record) => record && record.name);
    if (!valid.length) return 0;

    const columns = [
      'user_id', 'name', 'archetypes', 'mechanical_desc', 'narrative_desc', 'is_public',
      'is_maneuver', 'duration_value', 'duration_unit', 'lore_creator', 'lore_creator_npc_id',
    ];

    const values = [];
    const tuples = valid.map((record) => {
      const start = values.length;
      values.push(
        userId,
        record.name,
        record.archetypes ?? [],
        record.mechanical_desc ?? null,
        record.narrative_desc ?? null,
        record.is_public ?? false,
        record.is_maneuver ?? false,
        record.duration_value ?? null,
        record.duration_unit ?? 'instant',
        record.lore_creator ?? null,
        record.lore_creator_npc_id ?? null,
      );
      return `(${columns.map((_, idx) => `$${start + idx + 1}`).join(', ')})`;
    });

    const { rowCount } = await pool.query(
      `INSERT INTO abilities.entries (${columns.join(', ')}) VALUES ${tuples.join(', ')}`,
      values
    );
    return rowCount;
  },
};

module.exports = AbilityModel;
