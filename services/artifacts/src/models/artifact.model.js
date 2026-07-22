const pool = require('../config/db');

// Rarity sorts by its in-world scale, not alphabetically.
const RARITY_ORDER = "array_position(ARRAY['common','uncommon','rare','legendary'], a.rarity)";

const SORT_EXPR = {
  name:   'a.name',
  price:  'a.price',
  rarity: RARITY_ORDER,
};

function buildOrderBy(sort, dir) {
  const expr = SORT_EXPR[sort] || SORT_EXPR.name;
  const direction = dir === 'desc' ? 'DESC' : 'ASC';
  if (expr === SORT_EXPR.name) return `a.name ${direction}`;
  return `${expr} ${direction} NULLS LAST, a.name ASC`;
}

// Canonical = authored by an admin/game_master, or explicitly flagged via the
// "Зробити канонічним" action (a.is_canonical) regardless of owner.
const IS_CANONICAL_EXPR = "(COALESCE(cu.role IN ('admin', 'game_master'), false) OR a.is_canonical)";

const ArtifactModel = {
  async findAll(userId, { rarity, creator, search, sort, dir, scope, limit } = {}, isAdmin = false) {
    const params = [userId];
    // scope=community = public entries authored by other, non-canonical users
    // (used by the Dashboard's "Творіння спільноти" rail) — replaces the
    // default ownership clause instead of appending to it.
    const conditions = scope === 'community'
      ? ['a.is_public = true', 'a.user_id <> $1', `NOT ${IS_CANONICAL_EXPR}`]
      : [isAdmin ? 'TRUE' : '(a.user_id = $1 OR a.is_public = true)'];

    if (scope === 'canonical') conditions.push(IS_CANONICAL_EXPR);
    else if (scope === 'user') conditions.push(`NOT ${IS_CANONICAL_EXPR}`);

    if (rarity) {
      params.push(rarity);
      conditions.push(`a.rarity = $${params.length}`);
    }
    if (creator) {
      params.push(creator);
      conditions.push(`a.creator = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`a.name ILIKE $${params.length}`);
    }

    let limitClause = '';
    if (limit) {
      params.push(limit);
      limitClause = ` LIMIT $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT a.*, (a.user_id = $1) AS is_owner,
              ${IS_CANONICAL_EXPR} AS is_canonical, cu.username AS owner_username
       FROM artifacts.entries a
       LEFT JOIN auth.users cu ON cu.id = a.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${buildOrderBy(sort, dir)}${limitClause}`,
      params
    );
    return rows;
  },

  async findById(id, userId, isAdmin = false) {
    const visibility = isAdmin ? 'TRUE' : '(a.user_id = $2 OR a.is_public = true)';
    const { rows } = await pool.query(
      `SELECT a.*, (a.user_id = $2) AS is_owner,
              ${IS_CANONICAL_EXPR} AS is_canonical, cu.username AS owner_username
       FROM artifacts.entries a
       LEFT JOIN auth.users cu ON cu.id = a.user_id
       WHERE a.id = $1 AND ${visibility}`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const { name, description, is_public, price, image_url, creator, rarity } = data;

    const { rows } = await pool.query(
      `INSERT INTO artifacts.entries
         (user_id, name, description, is_public, price, image_url, creator, rarity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        userId, name,
        description ?? null, is_public ?? false,
        price ?? null, image_url ?? null,
        creator ?? null, rarity ?? null,
      ]
    );
    return rows[0];
  },

  async update(id, userId, data, isAdmin = false) {
    const { name, description, is_public, price, image_url, creator, rarity } = data;

    const { rows } = await pool.query(
      `UPDATE artifacts.entries
       SET name=$3, description=$4, is_public=$5, updated_at=NOW(),
           price=$6, image_url=$7, creator=$8, rarity=$9
       WHERE id=$1 AND (user_id=$2 OR $10 = true)
       RETURNING *`,
      [
        id, userId, name,
        description ?? null, is_public ?? false,
        price ?? null, image_url ?? null,
        creator ?? null, rarity ?? null, isAdmin,
      ]
    );
    return rows[0] || null;
  },

  async delete(id, userId, isAdmin = false) {
    const { rowCount } = await pool.query(
      `DELETE FROM artifacts.entries WHERE id = $1 AND (user_id = $2 OR $3 = true)`,
      [id, userId, isAdmin]
    );
    return rowCount > 0;
  },

  // GM/admin only — flags an artifact canonical regardless of who owns it.
  async setCanonical(id, isCanonical) {
    const { rows } = await pool.query(
      `UPDATE artifacts.entries SET is_canonical=$2, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, isCanonical]
    );
    return rows[0] || null;
  },
};

module.exports = ArtifactModel;
