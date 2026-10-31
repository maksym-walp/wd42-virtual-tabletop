const pool = require('../config/db');

// character_sheet.equipment holds one bare catalog UUID per row, but the
// catalog it can point at is four separate tables in the equipment schema:
// items/weapons/armor split out by 39-equipment-split-tables.sql, plus
// artifacts, which merged back in as a fourth sibling table by
// 51-merge-artifacts-into-equipment.sql (previously its own schema/service,
// see 24-artifacts-service.sql — now just equipment.artifacts, same schema
// as the rest). Resolving the id against the union of all four keeps a
// single sheet row type working for any of them, and since every split/merge
// preserved row ids, sheets that predate them keep pointing at the same rows.
// Columns a given catalog doesn't have are projected as NULL so all arms share
// one shape. Potions (equipment.potions, migration 110) are the fifth arm:
// heal_die/portions are generated there from tier/size.
const CATALOG = `(
        SELECT id, name, 'item'::varchar AS type,
               NULL::varchar AS damage_die, NULL::varchar AS modifier, NULL::smallint AS defense_value,
               description, is_public, price, image_url,
               NULL::varchar AS weapon_type, NULL::varchar[] AS weapon_grip,
               NULL::varchar AS armor_weight,
               NULL::varchar AS creator, NULL::varchar AS rarity,
               NULL::varchar AS effect, NULL::varchar AS potion_tier, NULL::varchar AS potion_size,
               NULL::smallint AS heal_die, NULL::smallint AS portions
        FROM equipment.items
        UNION ALL
        SELECT id, name, 'weapon'::varchar,
               damage_die, modifier, NULL::smallint,
               description, is_public, price, image_url,
               weapon_type, weapon_grip, NULL::varchar,
               NULL::varchar, NULL::varchar,
               NULL::varchar, NULL::varchar, NULL::varchar, NULL::smallint, NULL::smallint
        FROM equipment.weapons
        UNION ALL
        SELECT id, name, 'armor'::varchar,
               NULL::varchar, NULL::varchar, defense_value,
               description, is_public, price, image_url,
               NULL::varchar, NULL::varchar[], armor_weight,
               NULL::varchar, NULL::varchar,
               NULL::varchar, NULL::varchar, NULL::varchar, NULL::smallint, NULL::smallint
        FROM equipment.armor
        UNION ALL
        SELECT id, name, 'artifact'::varchar,
               NULL::varchar, NULL::varchar, NULL::smallint,
               description, is_public, price, image_url,
               NULL::varchar, NULL::varchar[], NULL::varchar,
               creator, rarity,
               NULL::varchar, NULL::varchar, NULL::varchar, NULL::smallint, NULL::smallint
        FROM equipment.artifacts
        UNION ALL
        SELECT id, name, 'potion'::varchar,
               NULL::varchar, NULL::varchar, NULL::smallint,
               description, is_public, price, image_url,
               NULL::varchar, NULL::varchar[], NULL::varchar,
               NULL::varchar, NULL::varchar,
               effect, potion_tier, potion_size, heal_die, portions
        FROM equipment.potions
      )`;

const ITEM_JSON = `CASE WHEN ei.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', ei.id, 'name', ei.name, 'type', ei.type,
                'damage_die', ei.damage_die, 'modifier', ei.modifier, 'defense_value', ei.defense_value,
                'description', ei.description, 'is_public', ei.is_public,
                'price', ei.price, 'image_url', ei.image_url,
                'weapon_type', ei.weapon_type, 'weapon_grip', ei.weapon_grip,
                'armor_weight', ei.armor_weight, 'creator', ei.creator, 'rarity', ei.rarity,
                'effect', ei.effect, 'potion_tier', ei.potion_tier, 'potion_size', ei.potion_size,
                'heal_die', ei.heal_die, 'portions', ei.portions
              ) END AS item`;

const EquipmentModel = {
  // LEFT JOIN cross-schema into the catalogs so the sheet can render the
  // item's name/description/stats read-only even when the viewer isn't its
  // owner and it's private — visibility onto the sheet itself is already
  // gated by character.controller's is_owner/is_public/GM check.
  async findAll(characterId) {
    const { rows } = await pool.query(
      `SELECT ce.*,
              ${ITEM_JSON}
       FROM character_sheet.equipment ce
       LEFT JOIN ${CATALOG} ei ON ei.id = ce.equipment_id
       WHERE ce.character_id = $1
       ORDER BY ce.mastered ASC, ei.name ASC NULLS LAST, ce.id`,
      [characterId]
    );
    return rows;
  },

  // Зброя з листів кількох персонажів одним запитом — трекер бою питає
  // пачкою разом з ефектами, щоб не робити N+1 на кожного комбатанта.
  // → { [characterId]: [{ equipment_id, name, damage_die, modifier, mastered }] }
  async weaponsForMany(characterIds) {
    if (!characterIds.length) return {};
    const { rows } = await pool.query(
      `SELECT ce.character_id, ce.equipment_id, ce.mastered, ei.name, ei.damage_die, ei.modifier
       FROM character_sheet.equipment ce
       JOIN ${CATALOG} ei ON ei.id = ce.equipment_id
       WHERE ce.character_id = ANY($1::uuid[]) AND ei.type = 'weapon'
       ORDER BY ei.name ASC`,
      [characterIds]
    );
    const byCharacter = {};
    for (const { character_id, ...weapon } of rows) {
      (byCharacter[character_id] ||= []).push(weapon);
    }
    return byCharacter;
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

  // containers / open_portions — запас зілля (повні ємності й залишок у
  // відкритій); для інших видів ці колонки не використовуються.
  async patch(characterId, equipmentId, { mastered, is_equipped, containers, open_portions }) {
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
         SET mastered      = COALESCE($3, mastered),
             is_equipped   = COALESCE($4, is_equipped),
             containers    = COALESCE($5, containers),
             open_portions = COALESCE($6, open_portions)
         WHERE character_id = $1 AND equipment_id = $2
         RETURNING *
       )
       SELECT ce.*,
              ${ITEM_JSON}
       FROM updated ce
       LEFT JOIN ${CATALOG} ei ON ei.id = ce.equipment_id`,
      [characterId, equipmentId, mastered ?? null, is_equipped ?? null,
        containers ?? null, open_portions ?? null]
    );
    return rows[0] || null;
  },

  // Рядок зілля з листа разом із даними каталогу — під блокуванням
  // транзакції випивання (client з withCharacterLock).
  async findPotionForUpdate(client, characterId, equipmentId) {
    const { rows } = await client.query(
      `SELECT ce.*, ${ITEM_JSON}
       FROM character_sheet.equipment ce
       JOIN ${CATALOG} ei ON ei.id = ce.equipment_id AND ei.type = 'potion'
       WHERE ce.character_id = $1 AND ce.equipment_id = $2
       FOR UPDATE OF ce`,
      [characterId, equipmentId]
    );
    return rows[0] || null;
  },

  // Порожнє зілля зникає з листа.
  async saveStock(client, characterId, equipmentId, { containers, open_portions }) {
    if (containers <= 0 && open_portions <= 0) {
      await client.query(
        `DELETE FROM character_sheet.equipment WHERE character_id = $1 AND equipment_id = $2`,
        [characterId, equipmentId]
      );
      return null;
    }
    const { rows } = await client.query(
      `UPDATE character_sheet.equipment SET containers = $3, open_portions = $4
       WHERE character_id = $1 AND equipment_id = $2 RETURNING *`,
      [characterId, equipmentId, containers, open_portions]
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
