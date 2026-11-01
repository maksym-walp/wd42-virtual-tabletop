const pool = require('../config/db');

// Модифікатори відкритих вузлів дерева (skill_tree.nodes.modifiers,
// міграція 112) — міжсхемне читання, як і treeSpellAccess поруч у
// spell-access.model.js. Сама таблиця належить сервісу skill-tree; лист
// лише читає її, щоб згорнути в roll_profiles (rules/modifiers.js).
//
// Назва вузла їде разом із модифікатором: гравцеві треба показати не лише
// «перевага», а й звідки вона взялася.

// Плоский список { id, target, mode, value, situational, note, node_title }.
async function treeModifiers(characterId, db = pool) {
  const { rows } = await db.query(
    `SELECT n.title, n.modifiers
       FROM character_sheet.tree_progress tp
       JOIN skill_tree.nodes n ON n.id = tp.node_id
      WHERE tp.character_id = $1
        AND jsonb_array_length(COALESCE(n.modifiers, '[]'::jsonb)) > 0
      ORDER BY tp.unlocked_at ASC`,
    [characterId]
  );
  return rows.flatMap((row) =>
    (Array.isArray(row.modifiers) ? row.modifiers : []).map((mod) => ({ ...mod, node_title: row.title }))
  );
}

// Те саме для кількох персонажів одразу — трекер бою просить ефекти
// пачкою (GET /effects?ids=), і робити запит на кожного було б N+1.
// → { [characterId]: [...модифікатори] }
async function treeModifiersForMany(characterIds, db = pool) {
  if (!characterIds.length) return {};
  const { rows } = await db.query(
    `SELECT tp.character_id, n.title, n.modifiers
       FROM character_sheet.tree_progress tp
       JOIN skill_tree.nodes n ON n.id = tp.node_id
      WHERE tp.character_id = ANY($1::uuid[])
        AND jsonb_array_length(COALESCE(n.modifiers, '[]'::jsonb)) > 0
      ORDER BY tp.unlocked_at ASC`,
    [characterIds]
  );
  const byCharacter = {};
  for (const row of rows) {
    const list = (byCharacter[row.character_id] ||= []);
    for (const mod of Array.isArray(row.modifiers) ? row.modifiers : []) {
      list.push({ ...mod, node_title: row.title });
    }
  }
  return byCharacter;
}

// Альтернативні навички чарування відкритих вузлів дерева
// (skill_tree.nodes.cast_skill_options, міграція 119) — та сама
// міжсхемна модель, що й вище для modifiers, але це довідкові дані для
// вибору гравця під час кастування (battle tracker), а не кидкові
// профілі, тож рахуються окремим шляхом, не всередині rules/modifiers.js.
// Плоский список { id, tradition_id, skill_key, note, node_title }.
async function treeCastSkillOptions(characterId, db = pool) {
  const { rows } = await db.query(
    `SELECT n.title, n.cast_skill_options
       FROM character_sheet.tree_progress tp
       JOIN skill_tree.nodes n ON n.id = tp.node_id
      WHERE tp.character_id = $1
        AND jsonb_array_length(COALESCE(n.cast_skill_options, '[]'::jsonb)) > 0
      ORDER BY tp.unlocked_at ASC`,
    [characterId]
  );
  return rows.flatMap((row) =>
    (Array.isArray(row.cast_skill_options) ? row.cast_skill_options : []).map((opt) => ({ ...opt, node_title: row.title }))
  );
}

// Те саме для кількох персонажів одразу → { [characterId]: [...варіанти] }.
async function treeCastSkillOptionsForMany(characterIds, db = pool) {
  if (!characterIds.length) return {};
  const { rows } = await db.query(
    `SELECT tp.character_id, n.title, n.cast_skill_options
       FROM character_sheet.tree_progress tp
       JOIN skill_tree.nodes n ON n.id = tp.node_id
      WHERE tp.character_id = ANY($1::uuid[])
        AND jsonb_array_length(COALESCE(n.cast_skill_options, '[]'::jsonb)) > 0
      ORDER BY tp.unlocked_at ASC`,
    [characterIds]
  );
  const byCharacter = {};
  for (const row of rows) {
    const list = (byCharacter[row.character_id] ||= []);
    for (const opt of Array.isArray(row.cast_skill_options) ? row.cast_skill_options : []) {
      list.push({ ...opt, node_title: row.title });
    }
  }
  return byCharacter;
}

module.exports = { treeModifiers, treeModifiersForMany, treeCastSkillOptions, treeCastSkillOptionsForMany };
