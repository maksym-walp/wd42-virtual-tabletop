const pool = require('../config/db');

// Освоєння форм вміння/заклинання персонажем — спільне для
// character_sheet.abilities і character_sheet.known_spells (однакові
// колонки form_tier / primary_form / mastered_forms, див. міграції 81 і 90).
//
// Ключі форм (ті самі, що в skill_tree.node_grants.form_key):
//   'main'                   — основна форма (при рівневих — «Повноцінна»);
//   'primitive'/'perfected'  — рівневі форми;
//   uuid                     — альтернативна форма.
// Рівневий ключ ↔ form_tier: 'main' ↔ 'full', решта збігаються.

const TIERS = ['primitive', 'full', 'perfected'];
const tierRank = (tier) => TIERS.indexOf(tier);
const tierOfKey = (key) => (key === 'main' ? 'full' : key);
const highestTier = (tiers) => tiers.reduce((best, t) => (best == null || tierRank(t) > tierRank(best) ? t : best), null);

// sourceTable is always a fixed literal from our own code
// ('abilities.entries' | 'spellbook.spells'), never user input.
// Які форми має запис: tierKinds — наявні додаткові рівневі форми,
// altIds — id альтернативних. null, якщо запису не існує.
async function formKeys(sourceTable, itemId, db = pool) {
  const { rows } = await db.query(
    `SELECT COALESCE(array_agg(f->>'kind') FILTER (WHERE f->>'kind' IN ('primitive', 'perfected')), '{}') AS tier_kinds,
            COALESCE(array_agg(f->>'id') FILTER (WHERE f->>'kind' = 'alternative'), '{}') AS alt_ids
     FROM ${sourceTable} s
     LEFT JOIN LATERAL jsonb_array_elements(s.forms) f ON true
     WHERE s.id = $1
     GROUP BY s.id`,
    [itemId]
  );
  if (!rows[0]) return null;
  return { tierKinds: rows[0].tier_kinds, altIds: rows[0].alt_ids };
}

// tiers — рівневі форми по зростанню ([] без рівневих форм);
// variants — основна + альтернативні (ключі для primary_form/mastered_forms).
function layout({ tierKinds = [], altIds = [] } = {}) {
  const tiers = tierKinds.length ? TIERS.filter((t) => t === 'full' || tierKinds.includes(t)) : [];
  return { tiers, variants: ['main', ...altIds] };
}

// Що дає персонажу набір ключів форм (null — усі форми): для рівневих —
// найвища з наданих рівневих форм; для альтернативних — усі надані форми
// освоєні, перша з них основна. Ключі, яких у запису вже немає,
// ігноруються; якщо не лишилося жодного — основна форма.
function progressForKeys(keys, fk) {
  const { tiers, variants } = layout(fk);
  if (tiers.length) {
    const chosen = keys == null ? tiers : keys.map(tierOfKey).filter((t) => tiers.includes(t));
    return { form_tier: highestTier(chosen) ?? 'full', primary_form: 'main', mastered_forms: ['main'] };
  }
  const chosen = keys == null ? variants : variants.filter((v) => keys.includes(v));
  const mastered = chosen.length ? chosen : ['main'];
  return { form_tier: null, primary_form: mastered[0], mastered_forms: mastered };
}

// Перевіряє й нормалізує поля освоєння форм з тіла запиту проти форм
// самого запису. Повертає { error } або { progress } лише з переданими
// полями (для add — із дефолтами):
//   form_tier      — 'full' або наявна рівнева форма; лише для записів
//                    з рівневими формами (при add типово — найнижча);
//   primary_form   — 'main' або id альтернативної форми;
//   mastered_forms — ключі з того самого набору; невідомі тихо відкидаються.
// allowed — ключі форм, які дерево розвитку відкрило персонажу (null — усі,
// див. checkPrerequisites); current — наявний рядок листа (для patch), чиї
// форми лишаються дозволеними. Недозволене не відхиляється, а обрізається:
// рівнева форма — до найвищої дозволеної, основна — до першої дозволеної,
// освоєні — до дозволених.
function resolveFormProgress(fk, body, { isAdd = false, allowed = null, current = null } = {}) {
  const { tiers, variants } = layout(fk);
  const progress = {};

  if (body.form_tier !== undefined) {
    if (!tiers.includes(body.form_tier)) return { error: 'Некоректна рівнева форма' };
    progress.form_tier = body.form_tier;
  } else if (isAdd) {
    progress.form_tier = tiers[0] ?? null;
  }

  if (body.primary_form !== undefined) {
    if (!variants.includes(body.primary_form)) return { error: 'Некоректна основна форма' };
    progress.primary_form = body.primary_form;
  } else if (isAdd) {
    progress.primary_form = 'main';
  }

  if (body.mastered_forms !== undefined) {
    if (!Array.isArray(body.mastered_forms)) return { error: 'mastered_forms має бути масивом' };
    progress.mastered_forms = [...new Set(body.mastered_forms)].filter((f) => variants.includes(f));
  }

  if (allowed) {
    if (tiers.length) {
      const cap = highestTier([
        ...allowed.map(tierOfKey).filter((t) => tiers.includes(t)),
        ...(current?.form_tier ? [current.form_tier] : []),
      ]) ?? tiers[0];
      if (progress.form_tier && tierRank(progress.form_tier) > tierRank(cap)) progress.form_tier = cap;
    } else {
      const ok = variants.filter((v) => allowed.includes(v) || (current?.mastered_forms || []).includes(v));
      if (progress.primary_form !== undefined && !ok.includes(progress.primary_form)) progress.primary_form = ok[0] ?? 'main';
      if (progress.mastered_forms) progress.mastered_forms = progress.mastered_forms.filter((f) => ok.includes(f));
    }
  }

  if (isAdd && !progress.mastered_forms?.length) progress.mastered_forms = [progress.primary_form];

  return { progress };
}

module.exports = { TIERS, formKeys, layout, progressForKeys, resolveFormProgress };
