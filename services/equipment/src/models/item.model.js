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

const ItemModel = {
  async findAll(userId, { type, weaponType, armorWeight, rarity, search, sort, dir, scope } = {}) {
    const params = [userId];
    const conditions = ['(i.user_id = $1 OR i.is_public = true)'];

    // Canonical = authored by an admin; user = everyone else. Constant SQL
    // (no interpolated input), so it is injection-safe.
    if (scope === 'canonical') conditions.push("cu.role = 'admin'");
    else if (scope === 'user') conditions.push("cu.role IS DISTINCT FROM 'admin'");

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
    if (rarity) {
      params.push(rarity);
      conditions.push(`i.rarity = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`i.name ILIKE $${params.length}`);
    }

    const { rows } = await pool.query(
      `SELECT i.*, (i.user_id = $1) AS is_owner,
              COALESCE(cu.role = 'admin', false) AS is_canonical
       FROM equipment.items i
       LEFT JOIN auth.users cu ON cu.id = i.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${buildOrderBy(sort, dir)}`,
      params
    );
    return rows;
  },

  async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT i.*, (i.user_id = $2) AS is_owner,
              COALESCE(cu.role = 'admin', false) AS is_canonical
       FROM equipment.items i
       LEFT JOIN auth.users cu ON cu.id = i.user_id
       WHERE i.id = $1 AND (i.user_id = $2 OR i.is_public = true)`,
      [id, userId]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    const {
      name, type, damage_die, defense_value, description, is_public,
      price, image_url, weapon_type, weapon_grip, armor_weight, creator, rarity,
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO equipment.items
         (user_id, name, type, damage_die, defense_value, description, is_public,
          price, image_url, weapon_type, weapon_grip, armor_weight, creator, rarity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        userId, name, type ?? 'item',
        damage_die ?? null, defense_value ?? null,
        description ?? null, is_public ?? false,
        price ?? null, image_url ?? null,
        weapon_type ?? null, weapon_grip ?? null, armor_weight ?? null,
        creator ?? null, rarity ?? null,
      ]
    );
    return rows[0];
  },

  async update(id, userId, data) {
    const {
      name, type, damage_die, defense_value, description, is_public,
      price, image_url, weapon_type, weapon_grip, armor_weight, creator, rarity,
    } = data;

    const { rows } = await pool.query(
      `UPDATE equipment.items
       SET name=$3, type=$4, damage_die=$5, defense_value=$6,
           description=$7, is_public=$8, updated_at=NOW(),
           price=$9, image_url=$10, weapon_type=$11, weapon_grip=$12,
           armor_weight=$13, creator=$14, rarity=$15
       WHERE id=$1 AND user_id=$2
       RETURNING *`,
      [
        id, userId, name, type ?? 'item',
        damage_die ?? null, defense_value ?? null,
        description ?? null, is_public ?? false,
        price ?? null, image_url ?? null,
        weapon_type ?? null, weapon_grip ?? null, armor_weight ?? null,
        creator ?? null, rarity ?? null,
      ]
    );
    return rows[0] || null;
  },

  async delete(id, userId) {
    const { rowCount } = await pool.query(
      'DELETE FROM equipment.items WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rowCount > 0;
  },
};

module.exports = ItemModel;
