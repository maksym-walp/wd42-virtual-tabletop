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

const ManeuverModel = {
  async findAll(userId, { search, sort, scope, limit } = {}) {
    const params = [userId];
    // scope=community = public entries authored by other, non-admin users
    // (used by the Dashboard's "Творіння спільноти" rail) — replaces the
    // default ownership clause instead of appending to it.
    const conditions = scope === 'community'
      ? ['m.is_public = true', 'm.user_id <> $1', "cu.role IS DISTINCT FROM 'admin'"]
      : ['(m.user_id = $1 OR m.is_public = true)'];

    if (scope === 'canonical') conditions.push("cu.role = 'admin'");
    else if (scope === 'user') conditions.push("cu.role IS DISTINCT FROM 'admin'");

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
              COALESCE(cu.role = 'admin', false) AS is_canonical
       FROM maneuvers.entries m
       LEFT JOIN auth.users cu ON cu.id = m.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}${limitClause}`,
      params
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT m.*, (m.user_id = $2) AS is_owner, ${prereqNodesSelect('m')},
              COALESCE(cu.role = 'admin', false) AS is_canonical
       FROM maneuvers.entries m
       LEFT JOIN auth.users cu ON cu.id = m.user_id
       WHERE m.id = $1 AND (m.user_id = $2 OR m.is_public = true)`,
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

  async update(id, userId, data) {
    const { name, duration_actions, description, is_public, prerequisite_node_ids, prerequisite_logic, image_url } = data;

    const { rows } = await pool.query(
      `UPDATE maneuvers.entries
       SET name=$3, duration_actions=$4, description=$5, is_public=$6,
           prerequisite_node_ids=$7, prerequisite_logic=$8, image_url=$9, updated_at=NOW()
       WHERE id=$1 AND user_id=$2
       RETURNING *`,
      [id, userId, name, duration_actions ?? 1, description ?? null, is_public ?? false, prerequisite_node_ids ?? [], prerequisite_logic ?? 'or', image_url ?? null]
    );
    return rows[0] || null;
  },

  async delete(id, userId) {
    const { rowCount } = await pool.query(
      'DELETE FROM maneuvers.entries WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rowCount > 0;
  },
};

module.exports = ManeuverModel;
