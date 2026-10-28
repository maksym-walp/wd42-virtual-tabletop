const { computeEffects, normalizeConditions } = require('../conditions');
const { maxHp } = require('../stats');
const { makeSkills, makeCharacter } = require('../__helpers__/rules');

const fatigue = (level) => [{ type: 'fatigue', level }];

describe('computeEffects', () => {
  it('has no effects without conditions', () => {
    const e = computeEffects([], makeSkills(), 'rogue');
    expect(e).toMatchObject({
      roll_mode: 'normal', heroic_disabled: false, reactions: 'normal', actions_per_turn: 3,
      initiative_modifier: 0, timer_speed: 1, rest_time_multiplier: 1, movement_penalty: 0,
      passive_defense_factor: 1, block_other_removal: false, unconscious: false, dead: false,
    });
  });

  it.each([
    [1, 'normal', 'dis', 3, -1, true],
    [2, 'dis', 'dis', 3, -2, true],
    [3, 'dis', 'none', 2, -3, true],
    [4, 'wdis', 'none', 2, -4, true],
    [5, 'wdis', 'none', 1, -5, true],
  ])('Втома %i keeps lower-level effects', (level, rollMode, reactions, actions, initiative, heroicDisabled) => {
    const e = computeEffects(fatigue(level), makeSkills(), 'rogue');
    expect(e.roll_mode).toBe(rollMode);
    expect(e.reactions).toBe(reactions);
    expect(e.actions_per_turn).toBe(actions);
    expect(e.initiative_modifier).toBe(initiative);
    expect(e.heroic_disabled).toBe(heroicDisabled);
    expect(e.block_other_removal).toBe(level === 5);
  });

  it('applies Хвороба: healing, timer speed, halved magic, slower rests, blocked magic', () => {
    const skills = makeSkills({ magic_sense: 5 });
    expect(computeEffects([{ type: 'illness', level: 1 }], skills, 'rogue')).toMatchObject({
      healing_disadvantage: true, timer_speed: 1, max_magic_effective: 20,
    });
    expect(computeEffects([{ type: 'illness', level: 3 }], skills, 'rogue')).toMatchObject({
      timer_speed: 2, max_magic_base: 20, max_magic_effective: 10, rest_time_multiplier: 1,
    });
    expect(computeEffects([{ type: 'illness', level: 5 }], skills, 'rogue')).toMatchObject({
      rest_time_multiplier: 2, magic_restore_blocked: true,
    });
  });

  it('lowers the die of linked skills at Травма 2 and disables them at Травма 4', () => {
    const skills = makeSkills({ endurance: 6, strength: 4 });
    const t2 = computeEffects([{ type: 'trauma', level: 2, skill_keys: ['endurance', 'strength'] }], skills, 'rogue');
    expect(t2.skill_dice.endurance).toBe('d4');
    expect(t2.skill_dice.strength).toBeNull();
    expect(t2.skill_dice.evasion).toBe('d4');
    expect(t2.skill_rank_penalty).toEqual({ endurance: 1, strength: 1 });
    expect(t2.movement_penalty).toBe(2);

    const t3 = computeEffects([{ type: 'trauma', level: 3, skill_keys: [] }], skills, 'rogue');
    expect(t3.passive_defense_factor).toBe(0.5);

    const t4 = computeEffects([{ type: 'trauma', level: 4, skill_keys: ['endurance'] }], skills, 'rogue');
    expect(t4.disabled_skill_keys).toEqual(['endurance']);
    expect(t4.skill_dice.endurance).toBeNull();
  });

  it('reads unconsciousness and death from death_scale', () => {
    expect(computeEffects([], [], 'rogue', { death_scale: 0 }).unconscious).toBe(true);
    expect(computeEffects([], [], 'rogue', { death_scale: 3 }).unconscious).toBe(false);
    expect(computeEffects([], [], 'rogue', { death_scale: -3 })).toMatchObject({ unconscious: false, dead: true });
  });
});

describe('normalizeConditions', () => {
  it('rejects unknown types, duplicates and out-of-range levels', () => {
    expect(() => normalizeConditions([], [{ type: 'poison', level: 1 }])).toThrow(/Невідомий стан/);
    expect(() => normalizeConditions([], [{ type: 'fatigue', level: 1 }, { type: 'fatigue', level: 2 }])).toThrow(/двічі/);
    expect(() => normalizeConditions([], [{ type: 'fatigue', level: 10 }])).toThrow(/від 0 до 9/);
    expect(() => normalizeConditions([], [{ type: 'fatigue', level: 1.5 }])).toThrow(/від 0 до 9/);
    expect(() => normalizeConditions([], 'x')).toThrow(/масивом/);
  });

  it('drops zero levels, orders keys and keeps skill_keys only on trauma', () => {
    const { conditions } = normalizeConditions([], [
      { type: 'trauma', level: 1, skill_keys: ['strength', 'strength', 'bogus'] },
      { type: 'illness', level: 0 },
      { type: 'fatigue', level: 2, skill_keys: ['strength'] },
    ]);
    expect(conditions).toEqual([
      { type: 'fatigue', level: 2 },
      { type: 'trauma', level: 1, skill_keys: ['strength'] },
    ]);
  });

  it('keeps previous trauma skill_keys when the input omits them', () => {
    const prev = [{ type: 'trauma', level: 1, skill_keys: ['acrobatics'] }];
    const { conditions } = normalizeConditions(prev, [{ type: 'trauma', level: 2 }]);
    expect(conditions).toEqual([{ type: 'trauma', level: 2, skill_keys: ['acrobatics'] }]);
  });

  it('blocks lowering other conditions while Втома is 5', () => {
    const prev = [{ type: 'fatigue', level: 5 }, { type: 'illness', level: 2 }];
    expect(() => normalizeConditions(prev, [{ type: 'fatigue', level: 5 }, { type: 'illness', level: 1 }]))
      .toThrow(/спершу зніміть Втому/);
    // Зняти саму Втому можна — і разом із нею інший стан.
    expect(() => normalizeConditions(prev, [{ type: 'fatigue', level: 4 }, { type: 'illness', level: 1 }])).not.toThrow();
    // Підвищувати інші стани блок не забороняє.
    expect(() => normalizeConditions(prev, [{ type: 'fatigue', level: 5 }, { type: 'illness', level: 3 }])).not.toThrow();
  });

  it('knocks the character out at level 6 and shifts the death scale for every further level', () => {
    expect(normalizeConditions(fatigue(5), fatigue(6), { deathScale: null }).death_scale).toBe(0);
    expect(normalizeConditions(fatigue(5), fatigue(6), { deathScale: 2 }).death_scale).toBe(0);
    // Уже на шкалі смерті з провалами — падіння маркер не скидає.
    expect(normalizeConditions(fatigue(5), fatigue(6), { deathScale: -1 }).death_scale).toBe(-1);
    expect(normalizeConditions(fatigue(5), fatigue(8), { deathScale: null }).death_scale).toBe(-2);
    expect(normalizeConditions(fatigue(6), fatigue(7), { deathScale: 0 }).death_scale).toBe(-1);
    expect(normalizeConditions(fatigue(4), fatigue(9), { deathScale: null }).death_scale).toBe(-3);
    // Зниження рівня шкалу не змінює.
    expect(normalizeConditions(fatigue(8), fatigue(6), { deathScale: -2 }).death_scale).toBe(-2);
  });

  it('applies the permanent Травма 5 effect only when Травма reaches 5', () => {
    const skills = makeSkills({ strength: 9, immunity: 8, magic_sense: 10, endurance: 12 });
    const next = normalizeConditions(
      [{ type: 'trauma', level: 4, skill_keys: [] }],
      [{ type: 'trauma', level: 5 }],
      { skills }
    );
    expect(next.physique_reset).toEqual({ keys: ['strength', 'immunity', 'magic_sense', 'endurance'], value: 8 });
    expect(normalizeConditions([{ type: 'trauma', level: 5 }], [{ type: 'trauma', level: 5 }], { skills }).physique_reset).toBeNull();
  });
});

describe('maxHp', () => {
  it('crosses one die per condition level and never slices with a negative count', () => {
    const character = makeCharacter({ health_dice_values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] });
    const skills = makeSkills();
    expect(maxHp(character, skills, [])).toBe(66);
    expect(maxHp(character, skills, fatigue(2))).toBe(66 - 11 - 10);
    expect(maxHp(character, skills, [{ type: 'fatigue', level: 9 }, { type: 'illness', level: 9 }])).toBe(0);
  });
});
