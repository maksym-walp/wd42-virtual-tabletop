import { CHARACTERISTICS } from './characterSheet';

// Довідник вузлових модифікаторів (skill_tree.nodes.modifiers, міграція 112).
// Дзеркало services/skill-tree/src/models/node-modifier.js — сервер усе одно
// валідує те, що прийшло, тут лише підписи для пікера.

// Кидки, що навичками не є. Підписи пояснюють, коли саме кидок трапляється,
// бо на дереві це не завжди очевидно.
export const COMBAT_TARGETS = [
  { key: 'initiative',      label: 'Ініціатива',              hint: 'кидок перед початком бою' },
  { key: 'attack',          label: 'Влучання',                hint: 'кидок атаки зброєю' },
  { key: 'damage_dice',     label: 'Кубики шкоди',            hint: 'Майстерність M — скільки кубиків шкоди кидати' },
  { key: 'death_save',      label: 'Рятівний кидок від смерті', hint: 'd12, 7+ — успіх' },
  { key: 'endurance_timer', label: 'Витривалість (таймер)',   hint: 'перевірка на Втому від таймера діяльності' },
  { key: 'immunity_check',  label: 'Імунітет (зараження)',    hint: 'перевірка проти хвороби чи отрути' },
];

export const SKILL_TARGETS = CHARACTERISTICS.flatMap((char) =>
  char.skills.map((skill) => ({ ...skill, group: char.label }))
);

export const TARGET_LABELS = Object.fromEntries([
  ...SKILL_TARGETS.map((t) => [t.key, t.label]),
  ...COMBAT_TARGETS.map((t) => [t.key, t.label]),
]);

// Режими кидка (розділ 1.1) + числові способи вплинути на нього.
export const MODIFIER_MODES = [
  { key: 'adv',       label: 'Перевага',             tone: 'good' },
  { key: 'dis',       label: 'Перешкода',            tone: 'bad' },
  { key: 'wadv',      label: 'Подвійна перевага',    tone: 'good' },
  { key: 'wdis',      label: 'Подвійна перешкода',   tone: 'bad' },
  { key: 'bal',       label: 'Баланс',               tone: 'neutral' },
  { key: 'ext',       label: 'Екстремум',            tone: 'neutral' },
  { key: 'bonus',     label: 'Плоский ±N',           tone: 'neutral', needsValue: true },
  { key: 'rank_up',   label: 'Кубик на ранг вище',   tone: 'good',    needsValue: true },
  { key: 'rank_down', label: 'Кубик на ранг нижче',  tone: 'bad',     needsValue: true },
];

export const MODE_LABELS = Object.fromEntries(MODIFIER_MODES.map((m) => [m.key, m.label]));
export const needsValue = (mode) => !!MODIFIER_MODES.find((m) => m.key === mode)?.needsValue;

// Кількість кубиків шкоди режиму не має — її можна лише додати.
export const modesForTarget = (target) =>
  (target === 'damage_dice' ? MODIFIER_MODES.filter((m) => m.key === 'bonus') : MODIFIER_MODES);

// Короткий підпис модифікатора для картки вузла: «Інтуїція — перевага».
export function modifierLabel(mod) {
  const target = TARGET_LABELS[mod.target] ?? mod.target;
  if (mod.mode === 'bonus') return `${target} ${mod.value > 0 ? '+' : ''}${mod.value}`;
  if (mod.mode === 'rank_up') return `${target}: кубик +${mod.value} ранг`;
  if (mod.mode === 'rank_down') return `${target}: кубик −${mod.value} ранг`;
  return `${target} — ${(MODE_LABELS[mod.mode] ?? mod.mode).toLowerCase()}`;
}
