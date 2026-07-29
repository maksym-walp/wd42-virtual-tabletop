const pool = require('../config/db');

// character_sheet.equipment holds one bare catalog UUID per row, but the
// catalogs it can point at are four separate tables: artifacts moved to their
// own schema in 24-artifacts-service.sql, and 39-equipment-split-tables.sql
// split the rest into equipment.items/weapons/armor (the `type` column is gone
// — the table now IS the type). Resolving the id against the union of all four
// keeps a single sheet row type working for any of them, and since every split
// preserved row ids, sheets that predate them keep pointing at the same rows.
// Columns a given catalog doesn't have are projected as NULL so all arms share
// one shape.
const CATALOG = `(
        SELECT id, name, 'item'::varchar AS type,
               NULL::varchar AS damage_die, NULL::smallint AS defense_value,
               description, is_public, price, image_url,
               NULL::varchar AS weapon_type, NULL::varchar AS weapon_grip,
               NULL::varchar AS armor_weight,
               NULL::varchar AS creator, NULL::varchar AS rarity
        FROM equipment.items
        UNION ALL
        SELECT id, name, 'weapon'::varchar,
               damage_die, NULL::smallint,
               description, is_public, price, image_url,
               weapon_type, weapon_grip, NULL::varchar,
               NULL::varchar, NULL::varchar
        FROM equipment.weapons
        UNION ALL
        SELECT id, name, 'armor'::varchar,
               NULL::varchar, defense_value,
               description, is_public, price, image_url,
               NULL::varchar, NULL::varchar, armor_weight,
               NULL::varchar, NULL::varchar
        FROM equipment.armor
        UNION ALL
        SELECT id, name, 'artifact'::varchar,
               NULL::varchar, NULL::smallint,
               description, is_public, price, image_url,
               NULL::varchar, NULL::varchar, NULL::varchar,
               creator, rarity
        FROM artifacts.entries
      )`;

const EquipmentModel = {
  // LEFT JOIN cross-schema into the catalogs so the sheet can render the
  // item's name/description/stats read-only even when the viewer isn't its
  // owner and it's private — visibility onto the sheet itself is already
  // gated by character.controller's is_owner/is_public/GM check.
  async findAll(characterId) {
    const { rows } = await pool.query(
      `SELECT ce.*,
              CASE WHEN ei.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', ei.id, 'name', ei.name, 'type', ei.type,
                'damage_die', ei.damage_die, 'defense_value', ei.defense_value,
                'description', ei.description, 'is_public', ei.is_public,
                'price', ei.price, 'image_url', ei.image_url,
                'weapon_type', ei.weapon_type, 'weapon_grip', ei.weapon_grip,
                'armor_weight', ei.armor_weight, 'creator', ei.creator, 'rarity', ei.rarity
              ) END AS item
       FROM character_sheet.equipment ce
       LEFT JOIN ${CATALOG} ei ON ei.id = ce.equipment_id
       WHERE ce.character_id = $1
       ORDER BY ce.mastered ASC, ce.mastery_count DESC`,
      [characterId]
    );
    return rows;
  },

  async add(characterId, equipmentId) {
    const { rows } = await pool.query(
      `INSERT INTO character_sheet.equipment (character_id, equipment_id)
       VALUES ($1, $2)
       ON CONFLICT (character_id, equipment_id) DO NOTHING
       RETURNING *`,
      [characterId, equipmentId]
    );
    return rows[0] || null;
  },

  async patch(characterId, equipmentId, { mastery_count, mastered, is_equipped }) {
    // Auto-master when mastery_count reaches 3
    const effectiveMastered = mastered ?? (mastery_count >= 3 ? true : undefined);

    // Одночасно вдягнений лише один обладунок: перш ніж виставити is_equipped
    // на цьому рядку, знімаємо прапорець з усіх ІНШИХ armor-рядків персонажа —
    // але лише якщо сам цей рядок і є обладунком (EXISTS-підзапит нижче).
    // Тип рядка визначаємо через CATALOG-join, а не ce.slot: та колонка
    // застаріла й завжди 'item', бо add() її не виставляє відколи
    // 39-equipment-split-tables.sql прибрала type із самого каталогу.
    if (is_equipped === true) {
      await pool.query(
        `UPDATE character_sheet.equipment ce
         SET is_equipped = false
         FROM ${CATALOG} ei
         WHERE ce.character_id = $1
           AND ce.equipment_id <> $2
           AND ei.id = ce.equipment_id
           AND ei.type = 'armor'
           AND ce.is_equipped = true
           AND EXISTS (
             SELECT 1 FROM ${CATALOG} target
             WHERE target.id = $2 AND target.type = 'armor'
           )`,
        [characterId, equipmentId]
      );
    }

    const { rows } = await pool.query(
      `WITH updated AS (
         UPDATE character_sheet.equipment
         SET mastery_count = COALESCE($3, mastery_count),
             mastered      = COALESCE($4, mastered),
             is_equipped   = COALESCE($5, is_equipped)
         WHERE character_id = $1 AND equipment_id = $2
         RETURNING *
       )
       SELECT ce.*,
              CASE WHEN ei.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', ei.id, 'name', ei.name, 'type', ei.type,
                'damage_die', ei.damage_die, 'defense_value', ei.defense_value,
                'description', ei.description, 'is_public', ei.is_public,
                'price', ei.price, 'image_url', ei.image_url,
                'weapon_type', ei.weapon_type, 'weapon_grip', ei.weapon_grip,
                'armor_weight', ei.armor_weight, 'creator', ei.creator, 'rarity', ei.rarity
              ) END AS item
       FROM updated ce
       LEFT JOIN ${CATALOG} ei ON ei.id = ce.equipment_id`,
      [characterId, equipmentId, mastery_count ?? null, effectiveMastered ?? null, is_equipped ?? null]
    );
    return rows[0] || null;
  },

  async remove(characterId, equipmentId) {
    const { rowCount } = await pool.query(
      `DELETE FROM character_sheet.equipment WHERE character_id = $1 AND equipment_id = $2`,
      [characterId, equipmentId]
    );
    return rowCount > 0;
  },
};

module.exports = EquipmentModel;
