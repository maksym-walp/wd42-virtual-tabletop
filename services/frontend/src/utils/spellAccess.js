import { SPELL_COMPLEXITIES, spellForms } from '../constants/spellbook';

// Доступність заклинання персонажу — дзеркало spell-access.model.js у
// character-sheet (сервер перевіряє те саме; тут — щоб одразу показати
// в UI, що доступно й чого бракує). Дерево розвитку відкриває традиції й
// складність (драбиною); заклинання доступне, коли відкрито хоч одну з його
// традицій (без традицій — завжди) І складність форми не вища за відкриту
// (без складності — завжди). Кожна форма — за власною складністю.
//
// access — sheet.spell_access: { traditions: [uuid], max_complexity }.

const ORDER = Object.keys(SPELL_COMPLEXITIES);
const rank = (c) => ORDER.indexOf(c);

export const complexityLabel = (c) => SPELL_COMPLEXITIES[c]?.label ?? c;

// spell — з каталогу (traditions: [{ id, name }]) або з листа (tradition_ids).
export function spellTraditionIds(spell) {
  return spell.tradition_ids ?? (spell.traditions || []).map((t) => t.id);
}

// { met, allowedForms: null | [key], missing: { traditionIds?, complexity? } }
export function spellAccessFor(spell, access) {
  if (!access) return { met: true, allowedForms: null, missing: {} };
  const traditionIds = spellTraditionIds(spell);
  const traditionOk = traditionIds.length === 0 || traditionIds.some((id) => access.traditions.includes(id));
  const cap = access.max_complexity ? rank(access.max_complexity) : -1;
  const forms = spellForms(spell);
  const allowed = forms.filter((f) => !f.complexity || rank(f.complexity) <= cap).map((f) => f.key);
  const met = traditionOk && allowed.length > 0;

  const missing = {};
  if (!traditionOk) missing.traditionIds = traditionIds;
  if (!allowed.length) {
    missing.complexity = forms.map((f) => f.complexity).reduce((low, c) => (low == null || rank(c) < rank(low) ? c : low), null);
  }
  return { met, allowedForms: met && allowed.length < forms.length ? allowed : (met ? null : []), missing };
}

// «Потрібно: традиція Вогню або Криги · складність «Комплексне»».
export function missingAccessLabel(missing, traditionNameOf = () => null) {
  const parts = [];
  if (missing.traditionIds?.length) {
    const names = missing.traditionIds.map(traditionNameOf).filter(Boolean);
    parts.push(names.length ? `традиція ${names.join(' або ')}` : 'традиція заклинання');
  }
  if (missing.complexity) parts.push(`складність «${complexityLabel(missing.complexity)}»`);
  return parts.length ? `Потрібно відкрити: ${parts.join(' · ')}` : '';
}
