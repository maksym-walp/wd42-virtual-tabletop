const { rollDice } = require('./dice');
const { ARCHETYPES, maxHp } = require('./stats');
const {
  computeEffects, normalizeConditions, levelOf, setLevel, CONDITION_LABELS,
} = require('./conditions');
const { advanceTimer, nextCheckAt, TIMER_RESET } = require('./timer');
const { habitDie, restPotionFields } = require('./potions');

// Три форми відпочинку. K — множник архетипу (fighter 2, rogue 4,
// spellcaster 6); кубик зцілення на ранг нижчий за кубик здоровʼя.
// Здоровʼя не піднімається вище поточного максимуму (з урахуванням
// закреслених кубиків), енергія — вище ефективного максимуму (Хвороба ≥3 —
// половина) і не відновлюється при Хворобі 5. Наявні значення понад
// максимум відпочинок не зменшує.
//
//   short — перепочинок (~4 год): +4 год таймера (8 при Хворобі ≥4, далі
//           множник Хвороби ≥2), +1 кубик зцілення, +K енергії;
//   full  — повноцінний (~12 год): +½ бракуючого здоровʼя, +K·d4 енергії,
//           −1 рівень Втоми або Хвороби (вибір; при Втомі 5 — лише Втома),
//           скидає таймер, повертає 1 героїчну дію;
//   long  — довготривале відновлення (~тиждень): знімає всю Втому й
//           Хворобу та 1 рівень Травми, здоровʼя й енергія — до максимуму,
//           усі героїчні дії, скидає таймер.
// Звикання до зілля: перепочинок знижує ранг кубика звикання на 1,
// повноцінний і довготривалий — скидають звикання повністю (potions.js).
// Порядок: спершу минає час / знімаються стани, потім рахується
// відновлення від нового максимуму.

const REST_KINDS = ['short', 'full', 'long'];
const REST_HOURS = { short: 4, full: 12, long: 168 };
const REST_LABELS = { short: 'Перепочинок', full: 'Повноцінний відпочинок', long: 'Довготривале відновлення' };

function restError(message, extra = {}) {
  const err = new Error(message);
  err.statusCode = 400;
  Object.assign(err, extra);
  return err;
}

// Які стани може зняти повноцінний відпочинок (при Втомі 5 — лише Втому).
function fullRestOptions(conditions) {
  const F = levelOf(conditions, 'fatigue');
  const I = levelOf(conditions, 'illness');
  const options = [];
  if (F > 0) options.push('fatigue');
  if (I > 0 && F < 5) options.push('illness');
  return options;
}

// Що знімає повноцінний відпочинок: null — нічого, інакше ключ стану.
function fullRestTarget(conditions, choice) {
  const options = fullRestOptions(conditions);
  if (!options.length) return null;
  if (options.length === 1) {
    if (choice && choice !== options[0]) {
      throw restError(`Зараз можна зняти лише стан «${CONDITION_LABELS[options[0]]}»`);
    }
    return options[0];
  }
  if (!choice) throw restError('Оберіть, який стан зняти', { code: 'choice_required', options });
  if (!options.includes(choice)) throw restError('Цей стан не можна зняти повноцінним відпочинком');
  return choice;
}

function restoreMagic(current, gain, effects, notes) {
  if (effects.magic_restore_blocked) {
    notes.push('Хвороба 5: енергія не відновлюється');
    return current;
  }
  return Math.max(current, Math.min(effects.max_magic_effective, current + gain));
}

// state: { character, skills }; options: { choice, rng }. Повертає
// { result, fields } — fields лягають у character_sheet.characters.
function rest(kind, { character, skills }, { choice = null, rng = Math.random } = {}) {
  if (!REST_KINDS.includes(kind)) throw restError('kind має бути short, full або long');
  const archetype = ARCHETYPES[character.archetype] || { multiplier: 0, healingDie: 4 };
  const startEffects = computeEffects(character.conditions, skills, character.archetype, character);

  let conditions = character.conditions || [];
  let deathScale = character.death_scale ?? null;
  const hpBefore = Number(character.current_hp) || 0;
  const magicBefore = Number(character.current_magic) || 0;
  const heroicUsed = Number(character.heroic_actions_used) || 0;
  let hp = hpBefore;
  let magic = magicBefore;
  let heroicAfter = heroicUsed;
  let timerFields = {};
  const rolls = [];
  const notes = [];
  const removed = [];
  let fatigueChecks = [];
  let hoursAdded = 0;

  const removeLevels = (type, by) => {
    const from = levelOf(conditions, type);
    const to = Math.max(0, from - by);
    if (from === to) return;
    const next = normalizeConditions(conditions, setLevel(conditions, type, to), { deathScale, skills });
    conditions = next.conditions;
    deathScale = next.death_scale;
    removed.push({ type, from, to });
  };

  const duration = REST_HOURS[kind] * startEffects.rest_time_multiplier;
  if (startEffects.rest_time_multiplier > 1) notes.push('Хвороба 4: відпочинок триває вдвічі довше');

  if (kind === 'short') {
    const timer = advanceTimer({ character, skills }, duration, rng);
    conditions = timer.conditions;
    deathScale = timer.death_scale;
    hoursAdded = timer.hours_added;
    fatigueChecks = timer.checks;
    timerFields = {
      rest_timer_hours: timer.rest_timer_hours,
      timer_checks_done: timer.timer_checks_done,
      timer_checks_passed: timer.timer_checks_passed,
    };
  } else if (kind === 'full') {
    const target = fullRestTarget(conditions, choice);
    if (target) removeLevels(target, 1);
    if (levelOf(character.conditions, 'fatigue') >= 5) notes.push('Втома 5: інші стани не знімаються, доки не знято Втому');
    timerFields = { ...TIMER_RESET };
    if (heroicUsed > 0) heroicAfter = heroicUsed - 1;
  } else {
    removeLevels('fatigue', Infinity);
    removeLevels('illness', Infinity);
    removeLevels('trauma', 1);
    if (levelOf(character.conditions, 'trauma') >= 5) notes.push('Постійна втрата навичок від Травми 5 не повертається');
    timerFields = { ...TIMER_RESET };
    heroicAfter = 0;
  }

  const potionFields = restPotionFields(kind, character);
  const rank = Number(character.potion_habit_rank) || 0;
  if (kind === 'short' && rank > 0) {
    notes.push(`Звикання до зілля: кубик ${rankDie(rank)} → ${rankDie(potionFields.potion_habit_rank)}`);
  } else if (kind !== 'short' && (rank > 0 || character.potion_habituated)) {
    notes.push('Звикання до зілля скинуто');
  }

  const effects = computeEffects(conditions, skills, character.archetype, { death_scale: deathScale });
  const hpMax = maxHp(character, skills, conditions);

  if (kind === 'short') {
    const heal = rollDice(1, archetype.healingDie, effects.healing_disadvantage ? 'dis' : 'normal', rng);
    rolls.push({ label: 'Кубик зцілення', ...heal });
    hp = Math.max(hp, Math.min(hpMax, hp + heal.total));
    magic = restoreMagic(magic, archetype.multiplier, effects, notes);
  } else if (kind === 'full') {
    const missing = hpMax - hp;
    if (missing > 0) hp += Math.ceil(missing / 2);
    if (!effects.magic_restore_blocked && archetype.multiplier > 0) {
      const energy = rollDice(archetype.multiplier, 4, 'normal', rng);
      rolls.push({ label: 'Магічна енергія', ...energy });
      magic = restoreMagic(magic, energy.total, effects, notes);
    } else {
      magic = restoreMagic(magic, 0, effects, notes);
    }
  } else {
    hp = Math.max(hp, hpMax);
    magic = restoreMagic(magic, effects.max_magic_effective, effects, notes);
  }

  const result = {
    kind,
    label: REST_LABELS[kind],
    duration_hours: duration,
    hours_added: hoursAdded,
    timer_reset: kind !== 'short',
    rolls,
    hp: { before: hpBefore, after: hp, max: hpMax },
    magic: { before: magicBefore, after: magic, max: effects.max_magic_effective },
    conditions_removed: removed,
    fatigue_checks: fatigueChecks,
    heroic_restored: heroicUsed - heroicAfter,
    notes,
  };

  return {
    result,
    fields: {
      conditions,
      death_scale: deathScale,
      current_hp: hp,
      current_magic: magic,
      heroic_actions_used: heroicAfter,
      ...timerFields,
      ...potionFields,
    },
  };
}

const rankDie = (rank) => `d${habitDie(rank)}`;

// Попередній перегляд відпочинку без кидків і без запису: що саме дасть
// кожна форма зараз (для підказки при наведенні в меню відпочинку).
// Повертає { kind, label, duration_hours, choice_options, lines }.
function previewRest(kind, { character, skills }) {
  if (!REST_KINDS.includes(kind)) throw restError('kind має бути short, full або long');
  const archetype = ARCHETYPES[character.archetype] || { multiplier: 0, healingDie: 4 };
  const conditions = character.conditions || [];
  const effects = computeEffects(conditions, skills, character.archetype, character);
  const duration = REST_HOURS[kind] * effects.rest_time_multiplier;
  const hp = Number(character.current_hp) || 0;
  const magic = Number(character.current_magic) || 0;
  const heroicUsed = Number(character.heroic_actions_used) || 0;
  const hours = Number(character.rest_timer_hours) || 0;
  const rank = Number(character.potion_habit_rank) || 0;
  const lines = [];
  let choiceOptions = [];

  const withLevels = (changes) => changes.reduce((list, [type, level]) => setLevel(list, type, level), conditions);
  const magicLine = (gain) => {
    if (effects.magic_restore_blocked) return 'Енергія не відновлюється (Хвороба 5)';
    if (magic >= effects.max_magic_effective) return `Енергія вже повна (${magic} / ${effects.max_magic_effective})`;
    return `Енергія ${gain} (${magic} → до ${effects.max_magic_effective})`;
  };

  if (kind === 'short') {
    const added = duration * effects.timer_speed;
    let checks = 0;
    for (let done = Number(character.timer_checks_done) || 0; hours + added >= nextCheckAt(done); done += 1) checks += 1;
    lines.push(`Таймер діяльності +${added} год (${hours} → ${hours + added})`);
    if (checks) lines.push(`Перевірок Витривалості: ${checks} — ризик Втоми`);
    const max = maxHp(character, skills, conditions);
    const formula = `${effects.healing_disadvantage ? 'dis(' : ''}1d${archetype.healingDie}${effects.healing_disadvantage ? ')' : ''}`;
    lines.push(hp >= max ? `Здоровʼя вже повне (${hp} / ${max})` : `Здоровʼя +${formula} (${hp} / ${max})`);
    lines.push(magicLine(`+${Math.min(archetype.multiplier, Math.max(0, effects.max_magic_effective - magic))}`));
    if (rank > 0) lines.push(`Звикання до зілля: кубик ${rankDie(rank)} → ${rankDie(rank - 1)}`);
    lines.push('Стани не знімаються, таймер не скидається');
  } else if (kind === 'full') {
    choiceOptions = fullRestOptions(conditions);
    if (!choiceOptions.length) lines.push('Станів, які знімає відпочинок, нема');
    for (const option of choiceOptions) {
      const level = levelOf(conditions, option);
      const max = maxHp(character, skills, withLevels([[option, level - 1]]));
      const gain = Math.max(0, Math.ceil((max - hp) / 2));
      lines.push(`${choiceOptions.length > 1 ? 'На вибір: ' : ''}${CONDITION_LABELS[option]} ${level} → ${level - 1}; здоровʼя +${gain} (${hp} → ${hp + gain})`);
    }
    if (!choiceOptions.length) {
      const max = maxHp(character, skills, conditions);
      const gain = Math.max(0, Math.ceil((max - hp) / 2));
      lines.push(gain ? `Здоровʼя +${gain} (${hp} → ${hp + gain})` : `Здоровʼя вже повне (${hp} / ${max})`);
    }
    if (levelOf(conditions, 'fatigue') >= 5) lines.push('Втома 5: інші стани не знімаються');
    lines.push(magicLine(`+${archetype.multiplier}d4`));
    lines.push(`Таймер діяльності скинеться (зараз ${hours} год)`);
    if (heroicUsed > 0) lines.push('+1 героїчна дія');
    if (rank > 0 || character.potion_habituated) lines.push('Звикання до зілля скинеться');
  } else {
    const after = withLevels([['fatigue', 0], ['illness', 0], ['trauma', Math.max(0, levelOf(conditions, 'trauma') - 1)]]);
    const removed = ['fatigue', 'illness', 'trauma']
      .map((type) => [type, levelOf(conditions, type), levelOf(after, type)])
      .filter(([, from, to]) => from !== to)
      .map(([type, from, to]) => `${CONDITION_LABELS[type]} ${from} → ${to}`);
    lines.push(removed.length ? `Знімає: ${removed.join(', ')}` : 'Станів, які знімає відновлення, нема');
    const max = maxHp(character, skills, after);
    lines.push(`Здоровʼя до максимуму (${hp} → ${Math.max(hp, max)})`);
    const afterEffects = computeEffects(after, skills, character.archetype, character);
    lines.push(`Енергія до максимуму (${magic} → ${Math.max(magic, afterEffects.max_magic_effective)})`);
    if (heroicUsed > 0) lines.push(`Усі героїчні дії (+${heroicUsed})`);
    lines.push(`Таймер діяльності скинеться (зараз ${hours} год)`);
    if (rank > 0 || character.potion_habituated) lines.push('Звикання до зілля скинеться');
    if (levelOf(conditions, 'trauma') >= 5) lines.push('Постійна втрата навичок від Травми 5 не повертається');
  }
  if (effects.rest_time_multiplier > 1) lines.push('Хвороба 4: відпочинок триває вдвічі довше');

  return { kind, label: REST_LABELS[kind], duration_hours: duration, choice_options: choiceOptions, lines };
}

module.exports = { REST_KINDS, REST_HOURS, REST_LABELS, rest, previewRest, fullRestTarget, fullRestOptions };
