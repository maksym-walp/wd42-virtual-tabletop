// Згортання модифікаторів відкритих вузлів дерева (skill_tree.nodes.modifiers,
// міграція 112) разом з ефектами станів в один блок roll_profiles — готову
// відповідь на питання «як саме кидати оцю перевірку просто зараз».
//
// Клієнт власних правил не має: він лише будує рядок формули для dice-roller
// з того, що тут пораховано, і показує гравцеві `sources` — звідки взялася
// перевага чи перешкода. Це та сама домовленість, що й для `effects`.

const {
  SKILL_KEYS, skillDieSides, lowerRank, raiseRank, skillValues, initiativeDieSides,
} = require('./stats');

const COMBAT_TARGETS = [
  'initiative', 'attack', 'damage_dice', 'death_save', 'endurance_timer', 'immunity_check',
];

// Перевірки, що справді кидаються кубиком d20. Важливо: перешкода Втоми
// («усі перевірки d20 — з перешкодою», розділ 5.2.1) діє лише на них.
// Рятівний кидок від смерті — d12 (5.3.2), перевірки таймера й Імунітету —
// лише кубик-модифікатор без d20 (5.2.1, 5.2.2), а ініціатива — власний
// кубик за Спритністю (4.1); Втома бʼє по ній окремо, через initiative_modifier.
const D20_TARGETS = new Set([...SKILL_KEYS, 'attack']);

// Вага режиму для правила 1.1.4: фактори переваги й перешкоди складаються,
// роблячи їх подвійними, або нівелюють одне одного.
const MODE_WEIGHT = { adv: 1, wadv: 2, dis: -1, wdis: -2 };
const WEIGHT_MODE = { '-2': 'wdis', '-1': 'dis', 0: 'normal', 1: 'adv', 2: 'wadv' };

// Зводить будь-який набір факторів в один режим кидка (розділ 1.1.4).
// Потрійної переваги чи перешкоди не буває, тож нетто затискається в ±2.
// Баланс і Екстремум — не фактори переваги, а окремі режими (1.1.5): вони
// діють лише тоді, коли перевага з перешкодою вже знулилися, а разом
// нівелюють одне одного, як протилежні режими.
function mergeRollModes(modes) {
  let net = 0;
  let bal = 0;
  let ext = 0;
  for (const mode of modes) {
    if (mode === 'bal') bal += 1;
    else if (mode === 'ext') ext += 1;
    else net += MODE_WEIGHT[mode] ?? 0;
  }
  net = Math.max(-2, Math.min(2, net));
  if (net !== 0) return WEIGHT_MODE[String(net)];
  if (bal && !ext) return 'bal';
  if (ext && !bal) return 'ext';
  return 'normal';
}

const dieLabel = (sides) => (sides ? `d${sides}` : null);

// Кубик-модифікатор навички з уже застосованими станами: Травма 4 вимикає
// навичку, Травма 2 знижує ранг (обидва вже пораховані в effects.skill_dice).
function skillDieFromEffects(key, effects, values) {
  if (effects?.skill_dice && key in effects.skill_dice) return effects.skill_dice[key];
  return dieLabel(skillDieSides(values[key] ?? 1));
}

const sidesOf = (die) => (die ? Number(String(die).slice(1)) : null);

// Один профіль: базовий кубик + усі модифікатори, що на нього вішаються.
function buildProfile({ die, baseModes, baseSources, mods, d20 }) {
  const modes = [...baseModes];
  const sources = [...baseSources];
  const situational = [];
  let bonus = 0;
  let rank = 0;

  for (const mod of mods) {
    const label = mod.node_title || 'Вузол дерева';
    if (mod.situational) {
      // Ситуативне не застосовується саме: гравець вмикає його перемикачем
      // у модалці кидка, коли умова з `note` справді виконана.
      situational.push({
        id: mod.id, mode: mod.mode, value: mod.value, note: mod.note, source: label,
      });
      continue;
    }
    if (mod.mode === 'bonus') {
      bonus += mod.value;
      sources.push(`${label}: ${mod.value > 0 ? '+' : ''}${mod.value}`);
    } else if (mod.mode === 'rank_up') {
      rank += mod.value;
      sources.push(`${label}: кубик на ${mod.value} ранг вище`);
    } else if (mod.mode === 'rank_down') {
      rank -= mod.value;
      sources.push(`${label}: кубик на ${mod.value} ранг нижче`);
    } else {
      modes.push(mod.mode);
      sources.push(label);
    }
  }

  let finalDie = die;
  if (rank && finalDie !== null) {
    const sides = sidesOf(finalDie);
    const shifted = rank > 0 ? raiseRank(sides, rank) : lowerRank(sides, -rank);
    finalDie = dieLabel(shifted);
  }

  return { die: finalDie, mode: mergeRollModes(modes), bonus, d20, sources, situational };
}

// modifiers — плоский список модифікаторів відкритих вузлів, кожен із
// node_title (див. models/tree-modifiers.model.js).
function rollProfiles(modifiers, effects, skills) {
  const values = skillValues(skills);
  const byTarget = {};
  for (const mod of Array.isArray(modifiers) ? modifiers : []) {
    (byTarget[mod.target] ||= []).push(mod);
  }

  // Перешкода Втоми — один фактор для всіх d20-перевірок.
  const conditionMode = effects?.roll_mode && effects.roll_mode !== 'normal' ? effects.roll_mode : null;
  const conditionLabel = conditionMode && effects?.roll_mode_source
    ? `Втома ${effects.roll_mode_source.level}`
    : 'Стани';

  const profiles = {};

  for (const key of SKILL_KEYS) {
    const disabled = !!effects?.disabled_skill_keys?.includes(key);
    const profile = buildProfile({
      die: skillDieFromEffects(key, effects, values),
      baseModes: conditionMode ? [conditionMode] : [],
      baseSources: conditionMode ? [conditionLabel] : [],
      mods: byTarget[key] ?? [],
      d20: true,
    });
    // Вимкнену Травмою навичку кидати не можна взагалі — жоден модифікатор
    // вузла цього не скасовує.
    profiles[key] = disabled
      ? { ...profile, die: null, disabled: true, disabled_reason: 'Травма: повʼязану навичку використовувати неможливо' }
      : { ...profile, disabled: false, disabled_reason: null };
  }

  profiles.initiative = buildProfile({
    die: dieLabel(initiativeDieSides(skills)),
    baseModes: [],
    baseSources: effects?.initiative_modifier ? [`Втома: ${effects.initiative_modifier}`] : [],
    mods: byTarget.initiative ?? [],
    d20: false,
  });
  // Втома зсуває ініціативу числом, а не режимом (5.2.1).
  profiles.initiative.bonus += effects?.initiative_modifier ?? 0;

  // Кубик влучання дає зброя (навичка з weapon.modifier), тож власного тут
  // немає: споживач зливає цей профіль із профілем обраної навички.
  profiles.attack = buildProfile({
    die: null,
    baseModes: conditionMode ? [conditionMode] : [],
    baseSources: conditionMode ? [conditionLabel] : [],
    mods: byTarget.attack ?? [],
    d20: true,
  });

  profiles.death_save = buildProfile({
    die: 'd12',
    baseModes: [],
    baseSources: [],
    mods: byTarget.death_save ?? [],
    d20: false,
  });

  profiles.endurance_timer = buildProfile({
    die: skillDieFromEffects('endurance', effects, values),
    baseModes: [],
    baseSources: [],
    mods: byTarget.endurance_timer ?? [],
    d20: false,
  });

  profiles.immunity_check = buildProfile({
    die: skillDieFromEffects('immunity', effects, values),
    baseModes: [],
    baseSources: [],
    mods: byTarget.immunity_check ?? [],
    d20: false,
  });

  // Майстерність M — кількість кубиків шкоди (4.4.3). За замовчуванням 1,
  // зростає лише вузлами дерева.
  const damageMods = byTarget.damage_dice ?? [];
  const damageSources = [];
  let count = 1;
  const damageSituational = [];
  for (const mod of damageMods) {
    if (mod.situational) {
      damageSituational.push({ id: mod.id, mode: mod.mode, value: mod.value, note: mod.note, source: mod.node_title });
      continue;
    }
    count += mod.value;
    damageSources.push(`${mod.node_title || 'Вузол дерева'}: +${mod.value}`);
  }
  profiles.damage_dice = {
    count: Math.max(1, count), sources: damageSources, situational: damageSituational,
  };

  return profiles;
}

module.exports = { mergeRollModes, rollProfiles, COMBAT_TARGETS, D20_TARGETS };
