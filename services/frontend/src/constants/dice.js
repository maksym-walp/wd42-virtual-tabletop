export const DIE_TYPES = [4, 6, 8, 10, 12, 20, 100];

// Identity map from a mode name to its backend formula keyword.
export const KEYWORD = {
  adv: 'adv', dis: 'dis', bal: 'bal', ext: 'ext', wadv: 'wadv', wdis: 'wdis',
};

export const MODE_BUTTONS = [
  { key: 'dis', label: 'Перешкода' },
  { key: 'normal', label: 'Звичайний' },
  { key: 'adv', label: 'Перевага' },
];

// The 4th "Спеціальні" option in the roll-type row opens a dropdown with
// these homebrew mechanics.
export const SPECIAL_OPTIONS = [
  { key: 'bal', label: 'Баланс' },
  { key: 'ext', label: 'Екстремум' },
  { key: 'wadv', label: 'Подвійна перевага' },
  { key: 'wdis', label: 'Подвійна перешкода' },
];

// A trailing bare "+N"/"-N" (no 'd') is always the flat modifier — dice
// terms never end that way (e.g. "1d6" ends in 'd6', "adv(1d10)" in ')').
const MODIFIER_RE = /[+-]\d+$/;
export const stripModifier = (formula) => formula.replace(MODIFIER_RE, '').trim();
export const withModifier = (base, modifier) => {
  if (!modifier) return base;
  return modifier > 0 ? `${base}+${modifier}` : `${base}${modifier}`;
};

// Merges same-type plain dice into a count ("1d20" + d20 click -> "2d20"),
// joins different types with '+' ("2d20+1d6").
export function addPlainDie(base, sides) {
  const re = new RegExp(`(^|\\+)(\\d+)d${sides}(?=$|\\+)`);
  const match = base.match(re);
  if (match) {
    const count = parseInt(match[2], 10) + 1;
    return base.replace(re, `${match[1]}${count}d${sides}`);
  }
  return base ? `${base}+1d${sides}` : `1d${sides}`;
}

// Fills the most recently opened empty wrapper ("adv()" -> "adv(1d8)"), or
// starts a new wrapped term if none is open.
export function addWrappedDie(base, mode, sides) {
  const keyword = KEYWORD[mode];
  const emptyRe = new RegExp(`${keyword}\\(\\)$`);
  if (emptyRe.test(base)) return base.replace(emptyRe, `${keyword}(1d${sides})`);
  const term = `${keyword}(1d${sides})`;
  return base ? `${base}+${term}` : term;
}

const DEFAULT_ROLL_SIDES = 20;

// Applies a mode-button/dropdown-option click to the formula text: renames
// the in-progress wrapper in place (keeping its dice, or defaulting to d20
// if it was still empty), opens a fresh wrapper pre-filled with 1d20, or
// (switching to "normal") drops a dangling empty wrapper the user never
// filled — a wrapper the user did fill is left as a locked-in term.
export function applyModeToFormula(base, oldMode, newMode) {
  if (newMode === oldMode) return base;

  if (oldMode !== 'normal') {
    const oldKeyword = KEYWORD[oldMode];
    const re = new RegExp(`(\\+)?${oldKeyword}\\(([^)]*)\\)$`);
    const match = base.match(re);
    if (match) {
      const [full, , inner] = match;
      const rest = base.slice(0, base.length - full.length);
      if (newMode === 'normal') return inner ? base : rest;
      const term = `${KEYWORD[newMode]}(${inner || `1d${DEFAULT_ROLL_SIDES}`})`;
      return rest ? `${rest}+${term}` : term;
    }
  }

  if (newMode === 'normal') return base;
  const term = `${KEYWORD[newMode]}(1d${DEFAULT_ROLL_SIDES})`;
  return base ? `${base}+${term}` : term;
}
