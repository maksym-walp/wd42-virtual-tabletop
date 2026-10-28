const { drinkPotion, consumeStock, availablePortions, potionView, restPotionFields, habitDie } = require('../potions');
const { rest, previewRest } = require('../rest');
const { face, seq, makeSkills, makeCharacter } = require('../__helpers__/rules');

// rogue, 11 кубиків по 5 → максимум 55; Імунітет 6 → d6.
const skills = makeSkills({ immunity: 6 });
const state = (overrides = {}) => ({ character: makeCharacter({ current_hp: 10, ...overrides }), skills });

describe('potion stock', () => {
  it('drinks from the open container first, then opens full ones', () => {
    expect(availablePortions({ containers: 2, open_portions: 1 }, 3)).toBe(7);
    expect(consumeStock({ containers: 2, open_portions: 1 }, 3, 1)).toEqual({ containers: 2, open_portions: 0 });
    expect(consumeStock({ containers: 2, open_portions: 1 }, 3, 2)).toEqual({ containers: 1, open_portions: 2 });
    expect(consumeStock({ containers: 2, open_portions: 1 }, 3, 7)).toEqual({ containers: 0, open_portions: 0 });
    expect(() => consumeStock({ containers: 1, open_portions: 0 }, 3, 4)).toThrow(/Стільки порцій/);
  });
});

describe('drinkPotion', () => {
  it('heals one tier die per portion and climbs the habituation ladder', () => {
    // Порція 1: d8 = 5, звикання d4 = 3 (ні); порція 2: d8 = 7, звикання d6 = 2 (ні).
    const { result, fields } = drinkPotion(state(), { healDie: 8, portions: 2 },
      seq(face(5, 8), face(3, 4), face(7, 8), face(2, 6)));
    expect(result.heal).toEqual({ full: 12, halved_raw: 0, halved: 0, total: 12 });
    expect(result.hp).toEqual({ before: 10, after: 22, max: 55 });
    expect(result.habituation.rolls.map((r) => [r.die, r.roll, r.habituated])).toEqual([['d4', 3, false], ['d6', 2, false]]);
    expect(result.habituation.next_die).toBe('d8');
    expect(result.immunity).toBeNull();
    expect(fields).toMatchObject({ current_hp: 22, potion_habit_rank: 2, potion_habituated: false, potion_excess_portions: 0 });
  });

  it('halves the portions after habituation (rounded up) and checks Immunity against all excess portions', () => {
    // Порція 1: d8 = 4, звикання d4 = 4 → звик. Порції 2–3: 5 + 4 = 9 → ½ = 5.
    // Імунітет d6 = 1 проти 2 — провал → Хвороба +1 (2 порції / 2).
    const { result, fields } = drinkPotion(state(), { healDie: 8, portions: 3 },
      seq(face(4, 8), face(4, 4), face(5, 8), face(4, 8), face(1, 6)));
    expect(result.heal).toEqual({ full: 4, halved_raw: 9, halved: 5, total: 9 });
    expect(result.habituation.became_habituated).toBe(true);
    expect(result.immunity).toEqual({
      die: 'd6', roll: 1, difficulty: 2, success: false, illness_added: 1, illness_before: 0, illness_after: 1,
    });
    expect(fields.conditions).toEqual([{ type: 'illness', level: 1 }]);
    expect(fields.potion_excess_portions).toBe(2);
    // Зцілення від зайвих порцій відбулося.
    expect(fields.current_hp).toBe(19);
  });

  it('adds only half of the illness levels (rounded down) on a passed Immunity check', () => {
    // Уже звик, 1 зайва порція раніше; 4 порції → ще 4 зайві, складність 5, d6 = 6 — успіх:
    // рівнів 2 → половина = 1.
    const { result } = drinkPotion(state({ potion_habituated: true, potion_habit_rank: 3, potion_excess_portions: 1 }),
      { healDie: 4, portions: 4 }, seq(face(1, 4), face(2, 4), face(3, 4), face(4, 4), face(6, 6)));
    expect(result.habituation.rolls).toEqual([]);
    expect(result.heal).toEqual({ full: 0, halved_raw: 10, halved: 5, total: 5 });
    expect(result.immunity).toMatchObject({ difficulty: 5, roll: 6, success: true, illness_added: 1 });
  });

  it('always fails the check without an Immunity die and rolls healing with disadvantage while ill', () => {
    const s = { character: makeCharacter({ potion_habituated: true, conditions: [{ type: 'illness', level: 1 }] }), skills: makeSkills({ immunity: 3 }) };
    const { result } = drinkPotion(s, { healDie: 6, portions: 1 }, seq(face(6, 6), face(2, 6)));
    expect(result.heal_rolls[0]).toMatchObject({ formula: 'dis(1d6)', values: [2], halved: true });
    expect(result.immunity).toMatchObject({ die: null, roll: 0, success: false, illness_added: 1, illness_after: 2 });
  });

  it('caps the ladder at d100 and validates the portion count', () => {
    expect([0, 4, 5, 6, 9].map(habitDie)).toEqual([4, 12, 20, 100, 100]);
    expect(() => drinkPotion(state(), { healDie: 4, portions: 0 })).toThrow(/portions/);
  });
});

describe('rests and habituation', () => {
  it('short rest lowers the habituation rank by one; full and long reset it', () => {
    const c = makeCharacter({ potion_habit_rank: 3, potion_habituated: true, potion_excess_portions: 4 });
    expect(restPotionFields('short', c)).toEqual({ potion_habit_rank: 2 });
    expect(restPotionFields('full', c)).toEqual({ potion_habit_rank: 0, potion_habituated: false, potion_excess_portions: 0 });

    const short = rest('short', { character: c, skills }, { rng: seq(face(1, 6)) });
    expect(short.fields.potion_habit_rank).toBe(2);
    expect(short.result.notes).toContain('Звикання до зілля: кубик d10 → d8');
    const full = rest('full', { character: c, skills }, { rng: seq(face(1, 4), face(1, 4), face(1, 4), face(1, 4)) });
    expect(full.fields).toMatchObject({ potion_habit_rank: 0, potion_habituated: false, potion_excess_portions: 0 });
    expect(full.result.notes).toContain('Звикання до зілля скинуто');
  });

  it('exposes the habituation state for the sheet', () => {
    expect(potionView(makeCharacter({ potion_habit_rank: 2 }))).toEqual({ habit_rank: 2, habituated: false, next_die: 'd8', excess_portions: 0 });
    expect(potionView(makeCharacter({ potion_habituated: true, potion_excess_portions: 3 })).next_die).toBeNull();
  });
});

describe('previewRest', () => {
  it('describes a short rest without rolling', () => {
    const p = previewRest('short', state({ rest_timer_hours: 10, conditions: [{ type: 'illness', level: 1 }], potion_habit_rank: 2 }));
    expect(p).toMatchObject({ kind: 'short', label: 'Перепочинок', duration_hours: 4 });
    expect(p.lines).toEqual(expect.arrayContaining([
      'Таймер діяльності +4 год (10 → 14)',
      'Перевірок Витривалості: 1 — ризик Втоми',
      'Здоровʼя +dis(1d6) (10 / 50)',
      'Звикання до зілля: кубик d8 → d6',
    ]));
  });

  it('lists the choice and HP gain per option for a full rest', () => {
    const p = previewRest('full', state({ conditions: [{ type: 'fatigue', level: 1 }, { type: 'illness', level: 1 }] }));
    expect(p.choice_options).toEqual(['fatigue', 'illness']);
    // Після зняття одного рівня — 10 кубиків по 5 = 50; бракує 40 → +20.
    expect(p.lines).toEqual(expect.arrayContaining([
      'На вибір: Втома 1 → 0; здоровʼя +20 (10 → 30)',
      'На вибір: Хвороба 1 → 0; здоровʼя +20 (10 → 30)',
      'Енергія +4d4 (0 → до 16)',
    ]));
  });

  it('describes a long recovery', () => {
    const p = previewRest('long', state({ conditions: [{ type: 'trauma', level: 2, skill_keys: [] }], heroic_actions_used: 1 }));
    expect(p.lines).toEqual(expect.arrayContaining([
      'Знімає: Травма 2 → 1', 'Здоровʼя до максимуму (10 → 50)', 'Усі героїчні дії (+1)',
    ]));
  });
});
