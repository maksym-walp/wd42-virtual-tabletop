const { rest } = require('../rest');
const { face, seq, makeSkills, makeCharacter } = require('../__helpers__/rules');

// rogue: K = 4, кубик зцілення d6; Чуття магії 5 → енергія 20.
const skills = makeSkills({ magic_sense: 5, endurance: 6 });
const state = (overrides = {}) => ({ character: makeCharacter(overrides), skills });

describe('rest: short', () => {
  it('adds 4 hours, heals one healing die and restores K energy without resetting the timer', () => {
    const { result, fields } = rest('short', state({ current_hp: 10, current_magic: 3, rest_timer_hours: 2 }), { rng: seq(face(4, 6)) });
    expect(result.hours_added).toBe(4);
    expect(result.rolls[0]).toMatchObject({ formula: '1d6', total: 4 });
    expect(fields).toMatchObject({ current_hp: 14, current_magic: 7, rest_timer_hours: 6 });
    expect(result.timer_reset).toBe(false);
  });

  it('heals with disadvantage at Хвороба 1 and never above the current maximum', () => {
    const { result, fields } = rest('short', state({
      conditions: [{ type: 'illness', level: 1 }], current_hp: 48,
    }), { rng: seq(face(6, 6), face(5, 6)) });
    expect(result.rolls[0]).toMatchObject({ formula: 'dis(1d6)', values: [5] });
    // 11 кубиків по 5, один закреслено → максимум 50.
    expect(fields.current_hp).toBe(50);
    expect(result.hp.max).toBe(50);
  });

  it('takes 8 hours at Хвороба 4, doubled again by the timer speed, and runs Fatigue checks', () => {
    const { result } = rest('short', state({ conditions: [{ type: 'illness', level: 4 }] }), {
      rng: seq(face(6, 6), face(3, 6), face(3, 6)),
    });
    expect(result.duration_hours).toBe(8);
    expect(result.hours_added).toBe(16);
    expect(result.fatigue_checks).toHaveLength(1);
  });

  it('does not restore energy at Хвороба 5', () => {
    const { result, fields } = rest('short', state({ conditions: [{ type: 'illness', level: 5 }], current_magic: 2 }), {
      rng: seq(face(1, 6), face(1, 6), face(1, 6)),
    });
    expect(fields.current_magic).toBe(2);
    expect(result.notes).toContain('Хвороба 5: енергія не відновлюється');
  });
});

describe('rest: full', () => {
  it('requires a choice when both Втома and Хвороба can be removed', () => {
    const s = state({ conditions: [{ type: 'fatigue', level: 1 }, { type: 'illness', level: 1 }] });
    expect(() => rest('full', s, { rng: seq() })).toThrow(expect.objectContaining({
      code: 'choice_required', options: ['fatigue', 'illness'], statusCode: 400,
    }));
  });

  it('removes the chosen condition, heals half of the missing HP, rolls K d4 energy, resets the timer and returns a heroic action', () => {
    const { result, fields } = rest('full', state({
      conditions: [{ type: 'fatigue', level: 1 }, { type: 'illness', level: 2 }],
      current_hp: 10, current_magic: 0, heroic_actions_used: 2,
      rest_timer_hours: 20, timer_checks_done: 2, timer_checks_passed: 1,
    }), { choice: 'illness', rng: seq(face(1, 4), face(2, 4), face(3, 4), face(4, 4)) });
    expect(result.conditions_removed).toEqual([{ type: 'illness', from: 2, to: 1 }]);
    // Після зняття закреслено 2 кубики → максимум 45; бракує 35 → +18.
    expect(fields.current_hp).toBe(28);
    expect(fields.current_magic).toBe(10);
    expect(fields.heroic_actions_used).toBe(1);
    expect(result.heroic_restored).toBe(1);
    expect(fields).toMatchObject({ rest_timer_hours: 0, timer_checks_done: 0, timer_checks_passed: 0 });
  });

  it('removes only Втома at Втома 5 and rejects choosing Хвороба', () => {
    const s = state({ conditions: [{ type: 'fatigue', level: 5 }, { type: 'illness', level: 2 }] });
    const { result } = rest('full', s, { rng: seq(face(1, 4), face(1, 4), face(1, 4), face(1, 4)) });
    expect(result.conditions_removed).toEqual([{ type: 'fatigue', from: 5, to: 4 }]);
    expect(() => rest('full', s, { choice: 'illness', rng: seq() })).toThrow(/лише стан «Втома»/);
  });
});

describe('rest: long', () => {
  it('removes all Втома and Хвороба and one level of Травма, restores everything and resets the timer', () => {
    const { result, fields } = rest('long', state({
      conditions: [
        { type: 'fatigue', level: 5 }, { type: 'illness', level: 3 }, { type: 'trauma', level: 5, skill_keys: ['strength'] },
      ],
      current_hp: 1, current_magic: 0, heroic_actions_used: 3, rest_timer_hours: 30, timer_checks_done: 4,
    }), { rng: seq() });
    expect(fields.conditions).toEqual([{ type: 'trauma', level: 4, skill_keys: ['strength'] }]);
    expect(fields.current_hp).toBe(35);
    expect(fields.current_magic).toBe(20);
    expect(fields.heroic_actions_used).toBe(0);
    expect(result.heroic_restored).toBe(3);
    expect(fields.rest_timer_hours).toBe(0);
    expect(result.notes).toContain('Постійна втрата навичок від Травми 5 не повертається');
  });

  it('rejects an unknown kind', () => {
    expect(() => rest('nap', state())).toThrow(/kind/);
  });
});
