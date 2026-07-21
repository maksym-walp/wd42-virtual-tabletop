const pool = require('../config/db');

const SORT_EXPR = {
  name:          'i.name',
  damage_die:    "NULLIF(regexp_replace(i.damage_die, '[^0-9]', '', 'g'), '')::int",
  defense_value: 'i.defense_value',
  price:         'i.price',
};

function buildOrderBy(sort, dir) {
  const expr = SORT_EXPR[sort] || SORT_EXPR.name;
  const direction = dir === 'desc' ? 'DESC' : 'ASC';
  if (expr === SORT_EXPR.name) return `i.name ${direction}`;
  return `${expr} ${direction} NULLS LAST, i.name ASC`;
}

// Canonical = authored by an admin/game_master, or explicitly flagged via the
// "Зробити канонічним" action (i.is_canonical) regardless of owner. Constant
// SQL (no interpolated input), so it is injection-safe.
const IS_CANONICAL_EXPR = "(COALESCE(cu.role IN ('admin', 'game_master'), false) OR i.is_canonical)";

const ItemModel = {
  async findAll(userId, { type, weaponType, armorWeight, search, sort, dir, scope } = {}, isAdmin = false) {
    const params = [userId];
    // The artifact exclusion bridges the two split migrations: between them
    // artifacts are copied into artifacts.entries but not yet deleted here, and
    // callers that merge both catalogs (the character sheet's item picker)
    // would list each one twice. 25-equipment-drop-artifacts.sql makes it moot.
    const conditions = [
      isAdmin ? 'TRUE' : '(i.user_id = $1 OR i.is_public = true)',
      "i.type <> 'artifact'",
    ];

    if (scope === 'canonical') conditions.push(IS_CANONICAL_EXPR);
    else if (scope === 'user') conditions.push(`NOT ${IS_CANONICAL_EXPR}`);

    if (type) {
      params.push(type);
      conditions.push(`i.type = $${params.length}`);
    }
    if (weaponType) {
      params.push(weaponType);
      conditions.push(`i.weapon_type = $${params.length}`);
    }
    if (armorWeight) {
      params.push(armorWeight);
      conditions.push(`i.armor_weight = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`i.name ILIKE $${params.length}`);
    }

    const { rows } = await pool.query(
      `SELECT i.*, (i.user_id = $1) AS is_owner,
              ${IS_CANONICAL_EXPR} AS is_canonical
       FROM equipment.items i
       LEFT JOIN auth.users cu ON cu.id = i.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${buildOrderBy(sort, dir)}`,
      params
    );
    return rows;
  },

  async findById(id, userId, isAdmin = false) {
    const visibility = isAdmin ? 'TRUE' : '(i.user_id = $2 OR i.is_public = true)';
    const { rows } = await pool.query(
      `SELECT i.*, (i.user_id = $2) AS is_owner,
              ${IS_CANONICAL_EXPR} AS is_canonical
       FROM equipment.items i
       LEFT JOIN auth.users cu ON cu.id = i.user_id
       WHERE i.id = $1 AND ${visibility}`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const {
      name, type, damage_die, defense_value, description, is_public,
      price, image_url, weapon_type, weapon_grip, armor_weight,
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO equipment.items
         (user_id, name, type, damage_die, defense_value, description, is_public,
          price, image_url, weapon_type, weapon_grip, armor_weight)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        userId, name, type ?? 'item',
        damage_die ?? null, defense_value ?? null,
        description ?? null, is_public ?? false,
        price ?? null, image_url ?? null,
        weapon_type ?? null, weapon_grip ?? null, armor_weight ?? null,
      ]
    );
    return rows[0];
  },

  async update(id, userId, data, isAdmin = false) {
    const {
      name, type, damage_die, defense_value, description, is_public,
      price, image_url, weapon_type, weapon_grip, armor_weight,
    } = data;
    const ownerCheck = isAdmin ? 'TRUE' : 'user_id=$2';

    const { rows } = await pool.query(
      `UPDATE equipment.items
       SET name=$3, type=$4, damage_die=$5, defense_value=$6,
           description=$7, is_public=$8, updated_at=NOW(),
           price=$9, image_url=$10, weapon_type=$11, weapon_grip=$12,
           armor_weight=$13
       WHERE id=$1 AND ${ownerCheck}
       RETURNING *`,
      [
        id, userId, name, type ?? 'item',
        damage_die ?? null, defense_value ?? null,
        description ?? null, is_public ?? false,
        price ?? null, image_url ?? null,
        weapon_type ?? null, weapon_grip ?? null, armor_weight ?? null,
      ]
    );
    return rows[0] || null;
  },

  async delete(id, userId, isAdmin = false) {
    const ownerCheck = isAdmin ? 'TRUE' : 'user_id = $2';
    const { rowCount } = await pool.query(
      `DELETE FROM equipment.items WHERE id = $1 AND ${ownerCheck}`,
      [id, userId]
    );
    return rowCount > 0;
  },

  // GM/admin only — flags an item canonical regardless of who owns it.
  async setCanonical(id, isCanonical) {
    const { rows } = await pool.query(
      `UPDATE equipment.items SET is_canonical=$2, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, isCanonical]
    );
    return rows[0] || null;
  },
};

module.exports = ItemModel;
