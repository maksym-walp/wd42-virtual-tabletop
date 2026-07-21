const pool = require('../config/db');

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
  async findAll(userId, { search, sort, archetype, scope, limit } = {}, isAdmin = false) {
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

    const orderBy = SORT_MAP[sort] || SORT_MAP.name;

    let limitClause = '';
    if (limit) {
      params.push(limit);
      limitClause = ` LIMIT $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT a.*, (a.user_id = $1) AS is_owner, ${prereqNodesSelect('a')},
              ${IS_CANONICAL_EXPR} AS is_canonical
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
              ${IS_CANONICAL_EXPR} AS is_canonical
       FROM abilities.entries a
       LEFT JOIN auth.users cu ON cu.id = a.user_id
       WHERE a.id = $1 AND ${visibility}`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const { name, archetypes, description, is_public, prerequisite_node_ids, prerequisite_logic, image_url } = data;

    const { rows } = await pool.query(
      `INSERT INTO abilities.entries
         (user_id, name, archetypes, description, is_public, prerequisite_node_ids, prerequisite_logic, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [userId, name, archetypes ?? [], description ?? null, is_public ?? false, prerequisite_node_ids ?? [], prerequisite_logic ?? 'or', image_url ?? null]
    );
    return rows[0];
  },

  async update(id, userId, data, isAdmin = false) {
    const { name, archetypes, description, is_public, prerequisite_node_ids, prerequisite_logic, image_url } = data;
    const ownerCheck = isAdmin ? 'TRUE' : 'user_id=$2';

    const { rows } = await pool.query(
      `UPDATE abilities.entries
       SET name=$3, archetypes=$4, description=$5, is_public=$6,
           prerequisite_node_ids=$7, prerequisite_logic=$8, image_url=$9, updated_at=NOW()
       WHERE id=$1 AND ${ownerCheck}
       RETURNING *`,
      [id, userId, name, archetypes ?? [], description ?? null, is_public ?? false, prerequisite_node_ids ?? [], prerequisite_logic ?? 'or', image_url ?? null]
    );
    return rows[0] || null;
  },

  async delete(id, userId, isAdmin = false) {
    const ownerCheck = isAdmin ? 'TRUE' : 'user_id = $2';
    const { rowCount } = await pool.query(
      `DELETE FROM abilities.entries WHERE id = $1 AND ${ownerCheck}`,
      [id, userId]
    );
    return rowCount > 0;
  },

  // GM/admin only — flags an ability canonical regardless of who owns it.
  async setCanonical(id, isCanonical) {
    const { rows } = await pool.query(
      `UPDATE abilities.entries SET is_canonical=$2, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, isCanonical]
    );
    return rows[0] || null;
  },
};

module.exports = AbilityModel;
