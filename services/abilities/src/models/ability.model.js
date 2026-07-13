const pool = require('../config/db');

const SORT_MAP = {
  name: 'a.name ASC',
};

const prereqNodesSelect = (alias) => `COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title) ORDER BY n.title)
     FROM skill_tree.nodes n WHERE n.id = ANY(${alias}.prerequisite_node_ids)),
    '[]'::jsonb
  ) AS prerequisite_nodes`;

const AbilityModel = {
  async findAll(userId, { search, sort, archetype } = {}) {
    const params = [userId];
    const conditions = ['(a.user_id = $1 OR a.is_public = true)'];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`a.name ILIKE $${params.length}`);
    }
    if (archetype) {
      params.push(archetype);
      conditions.push(`$${params.length} = ANY(a.archetypes)`);
    }

    const orderBy = SORT_MAP[sort] || SORT_MAP.name;

    const { rows } = await pool.query(
      `SELECT a.*, (a.user_id = $1) AS is_owner, ${prereqNodesSelect('a')}
       FROM abilities.entries a
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}`,
      params
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT a.*, (a.user_id = $2) AS is_owner, ${prereqNodesSelect('a')}
       FROM abilities.entries a
       WHERE a.id = $1 AND (a.user_id = $2 OR a.is_public = true)`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const { name, archetypes, description, is_public, prerequisite_node_ids, prerequisite_logic } = data;

    const { rows } = await pool.query(
      `INSERT INTO abilities.entries
         (user_id, name, archetypes, description, is_public, prerequisite_node_ids, prerequisite_logic)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [userId, name, archetypes ?? [], description ?? null, is_public ?? false, prerequisite_node_ids ?? [], prerequisite_logic ?? 'or']
    );
    return rows[0];
  },

  async update(id, userId, data) {
    const { name, archetypes, description, is_public, prerequisite_node_ids, prerequisite_logic } = data;

    const { rows } = await pool.query(
      `UPDATE abilities.entries
       SET name=$3, archetypes=$4, description=$5, is_public=$6,
           prerequisite_node_ids=$7, prerequisite_logic=$8, updated_at=NOW()
       WHERE id=$1 AND user_id=$2
       RETURNING *`,
      [id, userId, name, archetypes ?? [], description ?? null, is_public ?? false, prerequisite_node_ids ?? [], prerequisite_logic ?? 'or']
    );
    return rows[0] || null;
  },

  async delete(id, userId) {
    const { rowCount } = await pool.query(
      'DELETE FROM abilities.entries WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rowCount > 0;
  },
};

module.exports = AbilityModel;
