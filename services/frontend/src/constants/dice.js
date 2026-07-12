export const DIE_TYPES = [4, 6, 8, 10, 12, 20, 100];

// A second click on an already-active adv/dis button escalates to the
// homebrew "double" variant (backend keywords wadv/wdis).
export const KEYWORD = { adv: 'adv', wadv: 'wadv', dis: 'dis', wdis: 'wdis' };
const FAMILY = { adv: 'adv', wadv: 'adv', dis: 'dis', wdis: 'dis' };
export const DOUBLE_OF = { adv: 'wadv', dis: 'wdis' };

export const MODE_BUTTONS = [
  { key: 'dis', label: 'Перешкода' },
  { key: 'normal', label: 'Звичайний' },
  { key: 'adv', label: 'Перевага' },
];

// clicked is always one of 'dis' | 'normal' | 'adv' (the 3 buttons shown);
// current may additionally be 'wadv' | 'wdis'.
export function nextMode(current, clicked) {
  if (clicked === 'normal') return 'normal';
  const double = DOUBLE_OF[clicked];
  if (current === clicked) return double;
  if (current === double) return clicked;
  return clicked;
}

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

// Applies a mode-button click to the formula text: renames an in-progress
// empty/same-family wrapper in place, or opens a fresh one, or (switching to
// "normal") drops a dangling empty wrapper the user never filled.
export function applyModeToFormula(base, oldMode, newMode) {
  if (oldMode !== 'normal') {
    const oldKeyword = KEYWORD[oldMode];
    const emptyRe = new RegExp(`(\\+)?${oldKeyword}\\(\\)$`);
    if (emptyRe.test(base)) {
      const cleaned = base.replace(emptyRe, '');
      if (newMode === 'normal') return cleaned;
      return cleaned ? `${cleaned}+${KEYWORD[newMode]}()` : `${KEYWORD[newMode]}()`;
    }
  }
  if (newMode === 'normal') return base;
  const sameFamily = oldMode !== 'normal' && FAMILY[oldMode] === FAMILY[newMode];
  if (sameFamily) {
    const oldKeyword = KEYWORD[oldMode];
    const re = new RegExp(`${oldKeyword}(\\([^)]*\\))$`);
    if (re.test(base)) return base.replace(re, `${KEYWORD[newMode]}$1`);
  }
  const term = `${KEYWORD[newMode]}()`;
  return base ? `${base}+${term}` : term;
}
