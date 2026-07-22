const pool = require('../config/db');

const SORT_MAP = {
  name:             'm.name ASC',
  duration_actions: 'm.duration_actions ASC, m.name ASC',
};

const prereqNodesSelect = (alias) => `COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title) ORDER BY n.title)
     FROM skill_tree.nodes n WHERE n.id = ANY(${alias}.prerequisite_node_ids)),
    '[]'::jsonb
  ) AS prerequisite_nodes`;

// Canonical = authored by an admin/game_master, or explicitly flagged via the
// "Зробити канонічним" action (m.is_canonical) regardless of owner.
const IS_CANONICAL_EXPR = "(COALESCE(cu.role IN ('admin', 'game_master'), false) OR m.is_canonical)";

const ManeuverModel = {
  async findAll(userId, { search, sort, scope, limit } = {}, isAdmin = false) {
    const params = [userId];
    // scope=community = public entries authored by other, non-canonical users
    // (used by the Dashboard's "Творіння спільноти" rail) — replaces the
    // default ownership clause instead of appending to it.
    const conditions = scope === 'community'
      ? ['m.is_public = true', 'm.user_id <> $1', `NOT ${IS_CANONICAL_EXPR}`]
      : [isAdmin ? 'TRUE' : '(m.user_id = $1 OR m.is_public = true)'];

    if (scope === 'canonical') conditions.push(IS_CANONICAL_EXPR);
    else if (scope === 'user') conditions.push(`NOT ${IS_CANONICAL_EXPR}`);

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`m.name ILIKE $${params.length}`);
    }

    const orderBy = SORT_MAP[sort] || SORT_MAP.name;

    let limitClause = '';
    if (limit) {
      params.push(limit);
      limitClause = ` LIMIT $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT m.*, (m.user_id = $1) AS is_owner, ${prereqNodesSelect('m')},
              ${IS_CANONICAL_EXPR} AS is_canonical, cu.username AS owner_username
       FROM maneuvers.entries m
       LEFT JOIN auth.users cu ON cu.id = m.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}${limitClause}`,
      params
    );
    return rows;
  },

  async findById(id, userId, isAdmin = false) {
    const visibility = isAdmin ? 'TRUE' : '(m.user_id = $2 OR m.is_public = true)';
    const { rows } = await pool.query(
      `SELECT m.*, (m.user_id = $2) AS is_owner, ${prereqNodesSelect('m')},
              ${IS_CANONICAL_EXPR} AS is_canonical, cu.username AS owner_username
       FROM maneuvers.entries m
       LEFT JOIN auth.users cu ON cu.id = m.user_id
       WHERE m.id = $1 AND ${visibility}`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const { name, duration_actions, description, is_public, prerequisite_node_ids, prerequisite_logic, image_url } = data;

    const { rows } = await pool.query(
      `INSERT INTO maneuvers.entries
         (user_id, name, duration_actions, description, is_public, prerequisite_node_ids, prerequisite_logic, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [userId, name, duration_actions ?? 1, description ?? null, is_public ?? false, prerequisite_node_ids ?? [], prerequisite_logic ?? 'or', image_url ?? null]
    );
    return rows[0];
  },

  async update(id, userId, data, isAdmin = false) {
    const { name, duration_actions, description, is_public, prerequisite_node_ids, prerequisite_logic, image_url } = data;

    const { rows } = await pool.query(
      `UPDATE maneuvers.entries
       SET name=$3, duration_actions=$4, description=$5, is_public=$6,
           prerequisite_node_ids=$7, prerequisite_logic=$8, image_url=$9, updated_at=NOW()
       WHERE id=$1 AND (user_id=$2 OR $10 = true)
       RETURNING *`,
      [id, userId, name, duration_actions ?? 1, description ?? null, is_public ?? false, prerequisite_node_ids ?? [], prerequisite_logic ?? 'or', image_url ?? null, isAdmin]
    );
    return rows[0] || null;
  },

  async delete(id, userId, isAdmin = false) {
    const { rowCount } = await pool.query(
      `DELETE FROM maneuvers.entries WHERE id = $1 AND (user_id = $2 OR $3 = true)`,
      [id, userId, isAdmin]
    );
    return rowCount > 0;
  },

  // GM/admin only — flags a maneuver canonical regardless of who owns it.
  async setCanonical(id, isCanonical) {
    const { rows } = await pool.query(
      `UPDATE maneuvers.entries SET is_canonical=$2, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, isCanonical]
    );
    return rows[0] || null;
  },
};

module.exports = ManeuverModel;
