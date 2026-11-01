const pool = require('../config/db');
const { isCampaignGmForCharacter } = require('./campaign-access.model');

// Доступність заклинань персонажу (міграція 91). Вузли дерева розвитку
// відкривають традиції (nodes.unlocks_traditions) і складність
// (nodes.unlocks_complexity — драбиною, разом з усіма нижчими).
// Заклинання доступне, коли:
//   • відкрито хоч одну з його традицій (заклинання без традицій — завжди);
//   • І складність форми не вища за найвищу відкриту (форма без
//     складності — завжди). Кожна форма — за власною складністю, тож
//     персонажу може бути відкрита лише частина форм (allowedForms).
// Майстер (див. isSpellMaster) ці правила оминає.

const COMPLEXITIES = ['primitive', 'simple', 'medium', 'complex', 'extreme'];
const rank = (complexity) => COMPLEXITIES.indexOf(complexity);

// Що персонажу відкрило дерево: { traditions: [uuid], maxComplexity: key | null }.
async function treeSpellAccess(characterId, db = pool) {
  const { rows } = await db.query(
    `SELECT n.unlocks_traditions, n.unlocks_complexity
       FROM character_sheet.tree_progress tp
       JOIN skill_tree.nodes n ON n.id = tp.node_id
      WHERE tp.character_id = $1`,
    [characterId]
  );
  const traditions = [...new Set(rows.flatMap((r) => r.unlocks_traditions || []))];
  const maxComplexity = rows
    .map((r) => r.unlocks_complexity)
    .filter((c) => rank(c) >= 0)
    .reduce((best, c) => (best == null || rank(c) > rank(best) ? c : best), null);
  return { traditions, maxComplexity };
}

// Те саме для кількох персонажів одразу (battle tracker's GET /effects) →
// { [characterId]: { traditions, maxComplexity } }.
async function treeSpellAccessForMany(characterIds, db = pool) {
  if (!characterIds.length) return {};
  const { rows } = await db.query(
    `SELECT tp.character_id, n.unlocks_traditions, n.unlocks_complexity
       FROM character_sheet.tree_progress tp
       JOIN skill_tree.nodes n ON n.id = tp.node_id
      WHERE tp.character_id = ANY($1::uuid[])`,
    [characterIds]
  );
  const byCharacter = {};
  for (const id of characterIds) byCharacter[id] = { traditions: [], maxComplexity: null };
  const grouped = {};
  for (const row of rows) (grouped[row.character_id] ||= []).push(row);
  for (const [id, rs] of Object.entries(grouped)) {
    const traditions = [...new Set(rs.flatMap((r) => r.unlocks_traditions || []))];
    const maxComplexity = rs
      .map((r) => r.unlocks_complexity)
      .filter((c) => rank(c) >= 0)
      .reduce((best, c) => (best == null || rank(c) > rank(best) ? c : best), null);
    byCharacter[id] = { traditions, maxComplexity };
  }
  return byCharacter;
}

// Вимоги заклинання: традиції + складність кожної форми (ключі форм — див.
// form-progress.js). null, якщо заклинання не існує.
async function spellRequirements(spellId, db = pool) {
  const { rows } = await db.query(
    `SELECT s.complexity, s.forms,
            COALESCE(array_agg(ts.tradition_id) FILTER (WHERE ts.tradition_id IS NOT NULL), '{}') AS tradition_ids
       FROM spellbook.spells s
       LEFT JOIN spellbook.tradition_spells ts ON ts.spell_id = s.id
      WHERE s.id = $1
      GROUP BY s.id`,
    [spellId]
  );
  if (!rows[0]) return null;
  const { complexity, forms, tradition_ids: traditionIds } = rows[0];
  return {
    traditionIds,
    forms: [
      { key: 'main', complexity },
      ...(forms || []).map((f) => ({ key: f.kind, complexity: f.complexity ?? null })),
    ],
  };
}

// { met, allowedForms, missing } — allowedForms: null = усі форми,
// інакше ключі доступних; missing — чого бракує: { traditionIds, complexity }
// (найнижча складність, з якої відкрилася б хоч одна форма).
function evaluateSpellAccess(access, req) {
  const traditionOk = req.traditionIds.length === 0 || req.traditionIds.some((id) => access.traditions.includes(id));
  const cap = access.maxComplexity == null ? -1 : rank(access.maxComplexity);
  const formOk = (f) => f.complexity == null || rank(f.complexity) <= cap;
  const allowedKeys = req.forms.filter(formOk).map((f) => f.key);
  const met = traditionOk && allowedKeys.length > 0;

  const missing = {};
  if (!traditionOk) missing.traditionIds = req.traditionIds;
  if (!allowedKeys.length) {
    missing.complexity = req.forms.map((f) => f.complexity).reduce((low, c) => (low == null || rank(c) < rank(low) ? c : low), null);
  }

  let allowedForms = [];
  if (met) allowedForms = allowedKeys.length === req.forms.length ? null : allowedKeys;
  return { met, allowedForms, missing };
}

async function checkSpellAccess(characterId, spellId) {
  const req = await spellRequirements(spellId);
  if (!req) return { met: true, allowedForms: null, missing: {} };
  return evaluateSpellAccess(await treeSpellAccess(characterId), req);
}

// Майстер — адмін або ГМ кампанії цього персонажа: додає заклинання поза
// правилами доступності. Глобальна роль game_master сама по собі не дає
// цього права на персонажів поза власними кампаніями майстра.
async function isSpellMaster(req, characterId) {
  if (req.user.role === 'admin') return true;
  return isCampaignGmForCharacter(characterId, req.user.sub);
}

module.exports = {
  COMPLEXITIES, treeSpellAccess, treeSpellAccessForMany, spellRequirements, evaluateSpellAccess, checkSpellAccess, isSpellMaster,
};
