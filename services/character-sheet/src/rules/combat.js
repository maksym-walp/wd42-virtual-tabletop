// Наслідки удару по персонажу: здоровʼя, Травма й масивна шкода.
//
// Сюди приходить шкода, що вже пройшла пасивний захист (розділ 4.4.3) —
// поглинання рахує той, хто веде бій, бо захист лежить на комбатанті, а не
// на листі. Лист відповідає за те, що залежить саме від персонажа:
// поточний максимум здоровʼя, шкала смерті й пороги станів.

const { maxHp } = require('./stats');

// Рівень Травми ставиться не автоматично: розділ 5.2.3 лишає майстру
// вибір, яку частину тіла пошкоджено, тож повертаємо лише пропозицію.
const TRAUMA_SHARE = 0.5;
const MASSIVE_SHARE = 2;

const DEATH_MIN = -3;
const DEATH_MAX = 3;

const toInt = (v) => Math.trunc(Number(v) || 0);
const isUnconscious = (scale) => scale != null && scale > DEATH_MIN && scale < DEATH_MAX;

// → що станеться з персонажем; нічого не пише, лише рахує.
function applyDamage(character, skills, rawAmount) {
  const amount = Math.max(0, toInt(rawAmount));
  const max_hp = maxHp(character, skills);
  const hp_before = toInt(character.current_hp);
  const temp_before = toInt(character.temp_hp);
  const scale_before = character.death_scale == null ? null : toInt(character.death_scale);

  // Розділ 5.3.4: здоровʼя непритомного шкода не знижує, але влучання, що
  // пробило його пасивний захист, замальовує один провал.
  if (isUnconscious(scale_before)) {
    return {
      amount, max_hp,
      hp_before, hp_after: hp_before,
      temp_before, temp_after: temp_before,
      hp_lost: 0,
      unconscious_hit: amount > 0,
      death_scale: amount > 0 ? Math.max(DEATH_MIN, scale_before - 1) : scale_before,
      death_scale_before: scale_before,
      fell: false,
      massive: false,
      trauma_suggested: false,
    };
  }

  // Тимчасове здоровʼя приймає удар першим.
  const from_temp = Math.min(temp_before, amount);
  const to_hp = amount - from_temp;
  const temp_after = temp_before - from_temp;
  const hp_after = Math.max(0, hp_before - to_hp);

  // Масивна шкода (5.3.1) — удвічі більша за поточний максимум.
  const massive = max_hp > 0 && amount >= max_hp * MASSIVE_SHARE;
  // Травма (5.2.3) — від половини поточного максимуму. Більша шкода рівнів
  // не додає, тож це завжди не більш ніж одна пропозиція.
  const trauma_suggested = max_hp > 0 && amount >= Math.ceil(max_hp * TRAUMA_SHARE);

  const fell = hp_before > 0 && hp_after === 0;
  let death_scale = scale_before;
  // Падаючи, маркер стає на 0 (5.3.1).
  if (hp_after === 0 && death_scale == null) death_scale = 0;
  if (massive && death_scale != null) death_scale = Math.max(DEATH_MIN, death_scale - 1);

  return {
    amount, max_hp,
    hp_before, hp_after,
    temp_before, temp_after,
    hp_lost: hp_before - hp_after,
    unconscious_hit: false,
    death_scale,
    death_scale_before: scale_before,
    fell,
    massive,
    trauma_suggested,
  };
}

// Рятівний кидок від смерті (5.3.2): d12, 7–12 успіх, 1–6 провал.
// Модифікаторів немає, правило критів (1.1.3) не діє.
const DEATH_SAVE_SUCCESS = 7;

function applyDeathSave(character, rolled) {
  const scale_before = character.death_scale == null ? null : toInt(character.death_scale);
  if (!isUnconscious(scale_before)) return null;
  const success = toInt(rolled) >= DEATH_SAVE_SUCCESS;
  const death_scale = Math.max(DEATH_MIN, Math.min(DEATH_MAX, scale_before + (success ? 1 : -1)));
  return {
    rolled: toInt(rolled), success, death_scale, death_scale_before: scale_before,
    awake: death_scale >= DEATH_MAX, dead: death_scale <= DEATH_MIN,
  };
}

module.exports = {
  applyDamage, applyDeathSave,
  TRAUMA_SHARE, MASSIVE_SHARE, DEATH_SAVE_SUCCESS,
};
