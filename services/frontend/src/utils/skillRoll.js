import { modifierDie } from '../constants/characterSheet';

// Формули кидка навички з урахуванням обчислених сервером ефектів станів
// (блок effects листа, character-sheet src/rules/conditions.js): режим
// перешкоди діє на кожен кубик перевірки d20, кубик навички вже знижено
// Травмою (skill_dice), заборонені навички — disabled_skill_keys. Тут
// лише побудова рядка формули для dice-roller, без власних правил.

export const ROLL_MODE_LABELS = { dis: 'перешкода', wdis: 'подвійна перешкода' };

const wrap = (mode, group) => (mode === 'dis' || mode === 'wdis' ? `${mode}(${group})` : group);

// → { die, disabled, disabledReason, d20Formula, dieFormula, modeChip }
export function skillRoll(skillKey, value, effects, conditionLabels = {}) {
  const baseDie = modifierDie(value);
  const die = effects?.skill_dice ? effects.skill_dice[skillKey] ?? null : (baseDie === '—' ? null : baseDie);
  const disabled = !!effects?.disabled_skill_keys?.includes(skillKey);
  const mode = effects?.roll_mode ?? 'normal';
  const d20Formula = die ? `${wrap(mode, '1d20')}+${wrap(mode, `1${die}`)}` : wrap(mode, '1d20');
  const source = effects?.roll_mode_source;
  const modeChip = mode !== 'normal'
    ? `${ROLL_MODE_LABELS[mode]}${source ? ` (${conditionLabels[source.condition] ?? source.condition} ${source.level})` : ''}`
    : null;
  const lowered = !disabled && die !== (baseDie === '—' ? null : baseDie);
  return {
    die,
    baseDie: baseDie === '—' ? null : baseDie,
    lowered,
    disabled,
    disabledReason: disabled ? 'Травма: повʼязану навичку використовувати неможливо' : null,
    d20Formula,
    // Кидок лише кубика-модифікатора — без d20, перешкоди Втоми на нього не діють.
    dieFormula: die ? `1${die}` : null,
    modeChip,
  };
}
