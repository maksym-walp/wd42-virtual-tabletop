const pool = require('../config/db');

// Рівнева форма вміння/заклинання, яку персонаж опанував — спільне для
// character_sheet.abilities і character_sheet.known_spells (одна й та сама
// колонка form_tier, див. міграції 81/90/117). Відколи альтернативні форми
// прибрано (міграція 117), це єдиний стан прогресу форм — primary_form і
// mastered_forms більше не існують.
//
// Рівневий ключ ('main'/'primitive'/'perfected' — ті самі, що в
// skill_tree.node_grants.form_key) ↔ form_tier: 'main' ↔ 'full', решта
// збігаються.

const TIERS = ['primitive', 'full', 'perfected'];
const tierRank = (tier) => TIERS.indexOf(tier);
const tierOfKey = (key) => (key === 'main' ? 'full' : key);
const highestTier = (tiers) => tiers.reduce((best, t) => (best == null || tierRank(t) > tierRank(best) ? t : best), null);

// sourceTable is always a fixed literal from our own code
// ('abilities.entries' | 'spellbook.spells'), never user input.
// Рівневі форми запису по зростанню ([] — без рівневих форм, лише основна).
// null, якщо запису не існує.
async function entryTiers(sourceTable, itemId, db = pool) {
  const { rows } = await db.query(
    `SELECT COALESCE(array_agg(f->>'kind') FILTER (WHERE f->>'kind' IN ('primitive', 'perfected')), '{}') AS tier_kinds
     FROM ${sourceTable} s
     LEFT JOIN LATERAL jsonb_array_elements(s.forms) f ON true
     WHERE s.id = $1
     GROUP BY s.id`,
    [itemId]
  );
  if (!rows[0]) return null;
  const tierKinds = rows[0].tier_kinds;
  return tierKinds.length ? TIERS.filter((t) => t === 'full' || tierKinds.includes(t)) : [];
}

// Перевіряє й нормалізує form_tier з тіла запиту проти рівневих форм самого
// запису (tiers — результат entryTiers, [] для записів без рівневих форм).
// Повертає { error } або { form_tier } (лише коли передане або isAdd).
//
// allowed — ключі форм ('main'/'primitive'/'perfected'), які дерево
// розвитку відкрило персонажу (null — усі); current — наявний рядок листа
// (для patch), чий form_tier лишається дозволеним. Недозволене не
// відхиляється, а обрізається до найвищого дозволеного.
function resolveFormTier(tiers, body, { isAdd = false, allowed = null, current = null } = {}) {
  let form_tier;
  if (body.form_tier !== undefined) {
    if (!tiers.includes(body.form_tier)) return { error: 'Некоректна рівнева форма' };
    form_tier = body.form_tier;
  } else if (isAdd) {
    form_tier = tiers[0] ?? null;
  } else {
    return {};
  }

  if (allowed && tiers.length && form_tier) {
    const cap = highestTier([
      ...allowed.map(tierOfKey).filter((t) => tiers.includes(t)),
      ...(current?.form_tier ? [current.form_tier] : []),
    ]) ?? tiers[0];
    if (tierRank(form_tier) > tierRank(cap)) form_tier = cap;
  }

  return { form_tier };
}

// Яку рівневу форму дає персонажу набір наданих ключів форм (null — усі):
// найвища з наданих рівневих форм; якщо tiers порожній — null (запис без
// рівневих форм); якщо жоден із наданих ключів не рівневий — 'full' (основна
// форма в записі є завжди). Використовується вузлами дерева, що видають
// вміння напряму (tree-progress.model.js::applyGrants).
function tierForKeys(keys, tiers) {
  if (!tiers.length) return null;
  const chosen = keys == null ? tiers : keys.map(tierOfKey).filter((t) => tiers.includes(t));
  return highestTier(chosen) ?? 'full';
}

module.exports = { TIERS, entryTiers, resolveFormTier, tierForKeys };
