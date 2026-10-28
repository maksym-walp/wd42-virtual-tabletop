// Короткі чипи з обчисленого блоку effects (character-sheet) — для листа,
// Ширми й трекера бою. Лише відображення полів, правил тут нема.
// tone: 'danger' — суттєве обмеження, 'warn' — помірне.
export function effectChips(effects, { conditionLabels = {} } = {}) {
  if (!effects) return [];
  const chips = [];
  const fatigue = conditionLabels.fatigue ?? 'Втома';
  if (effects.dead) chips.push({ key: 'dead', text: 'Помер', tone: 'danger' });
  else if (effects.unconscious) chips.push({ key: 'unconscious', text: 'Непритомний', tone: 'danger' });
  if (effects.initiative_modifier) chips.push({ key: 'initiative', text: `${effects.initiative_modifier} ініціатива (${fatigue})`, tone: 'warn' });
  if (effects.actions_per_turn < 3) chips.push({ key: 'actions', text: `Дій у бою: ${effects.actions_per_turn}`, tone: 'danger' });
  if (effects.reactions === 'dis') chips.push({ key: 'reactions', text: 'Реакції з перешкодою', tone: 'warn' });
  if (effects.reactions === 'none') chips.push({ key: 'reactions', text: 'Без реакції', tone: 'danger' });
  if (effects.heroic_disabled) chips.push({ key: 'heroic', text: 'Без героїчних дій', tone: 'warn' });
  if (effects.roll_mode === 'dis') chips.push({ key: 'roll', text: 'd20 з перешкодою', tone: 'warn' });
  if (effects.roll_mode === 'wdis') chips.push({ key: 'roll', text: 'd20 з подвійною перешкодою', tone: 'danger' });
  if (effects.movement_penalty) chips.push({ key: 'movement', text: `Переміщення −${effects.movement_penalty}`, tone: 'warn' });
  if (effects.passive_defense_factor < 1) chips.push({ key: 'defense', text: 'Пасивний захист ×½', tone: 'warn' });
  if (effects.healing_disadvantage) chips.push({ key: 'healing', text: 'Зцілення з перешкодою', tone: 'warn' });
  if (effects.timer_speed > 1) chips.push({ key: 'timer', text: `Таймер ×${effects.timer_speed}`, tone: 'warn' });
  if (effects.max_magic_effective < effects.max_magic_base) chips.push({ key: 'magic', text: 'Енергія макс. ×½', tone: 'warn' });
  if (effects.rest_time_multiplier > 1) chips.push({ key: 'rest', text: `Відпочинок ×${effects.rest_time_multiplier} часу`, tone: 'warn' });
  if (effects.magic_restore_blocked) chips.push({ key: 'magic_block', text: 'Енергія не відновлюється', tone: 'danger' });
  if (effects.disabled_skill_keys?.length) chips.push({ key: 'skills_off', text: `Недоступні навички: ${effects.disabled_skill_keys.length}`, tone: 'danger' });
  else if (Object.keys(effects.skill_rank_penalty ?? {}).length) chips.push({ key: 'skills_low', text: 'Навички Травми −1 ранг', tone: 'warn' });
  if (effects.block_other_removal) chips.push({ key: 'block', text: `Спершу зняти ${fatigue}`, tone: 'danger' });
  return chips;
}

const TONES = {
  danger: 'border-danger/40 bg-danger/10 text-danger',
  warn: 'border-gold/40 bg-gold/10 text-gold',
};

export function chipClass(tone) {
  return `inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${TONES[tone] ?? TONES.warn}`;
}
