const { advanceTimer, nextCheckAt } = require('../timer');
const { face, seq, makeSkills, makeCharacter } = require('../__helpers__/rules');

const state = (overrides = {}, skills = makeSkills({ endurance: 6 })) => ({ character: makeCharacter(overrides), skills });

describe('advanceTimer', () => {
  it('schedules checks at 12, 18, 24, …', () => {
    expect([0, 1, 2, 3].map(nextCheckAt)).toEqual([12, 18, 24, 30]);
  });

  it('makes no check before 12 hours', () => {
    const t = advanceTimer(state(), 11, seq());
    expect(t.checks).toEqual([]);
    expect(t.rest_timer_hours).toBe(11);
    expect(t.next_check_at).toBe(12);
  });

  it('rolls only the Endurance die against D = max(1, h) × (F + 1)', () => {
    const t = advanceTimer(state(), 12, seq(face(1, 6)));
    expect(t.checks).toEqual([{ threshold: 12, die: 'd6', roll: 1, difficulty: 1, success: true, fatigue_before: 0, fatigue_after: 0 }]);
    expect(t.timer_checks_passed).toBe(1);
    expect(t.timer_checks_done).toBe(1);
  });

  it('checks every crossed threshold in order within one advance', () => {
    // 12: d6=3 ≥ 1 → h=1; 18: D=1·1=1, d6=2 → h=2; 24: D=2·1=2, d6=1 → провал, Втома 1.
    const t = advanceTimer(state(), 25, seq(face(3, 6), face(2, 6), face(1, 6)));
    expect(t.checks.map((c) => [c.threshold, c.difficulty, c.success])).toEqual([[12, 1, true], [18, 1, true], [24, 2, false]]);
    expect(t.fatigue_after).toBe(1);
    expect(t.conditions).toEqual([{ type: 'fatigue', level: 1 }]);
    expect(t.next_check_at).toBe(30);
  });

  it('uses the current Fatigue in the difficulty', () => {
    // Втома 2, h = 3 → D = 3 × 3 = 9 > 6 — провал навіть на максимумі.
    const t = advanceTimer(state({
      conditions: [{ type: 'fatigue', level: 2 }], rest_timer_hours: 30, timer_checks_done: 3, timer_checks_passed: 3,
    }), 5, seq(face(6, 6)));
    expect(t.checks[0]).toMatchObject({ threshold: 30, difficulty: 9, roll: 6, success: false, fatigue_after: 3 });
  });

  it('always fails without an Endurance die (1–3)', () => {
    const t = advanceTimer(state({}, makeSkills({ endurance: 3 })), 12, seq());
    expect(t.checks[0]).toMatchObject({ die: null, roll: 0, difficulty: 1, success: false, fatigue_after: 1 });
  });

  it('doubles the added hours at Хвороба 2+', () => {
    const t = advanceTimer(state({ conditions: [{ type: 'illness', level: 2 }] }), 6, seq(face(6, 6)));
    expect(t.hours_added).toBe(12);
    expect(t.rest_timer_hours).toBe(12);
    expect(t.checks).toHaveLength(1);
  });

  it('skips checks while unconscious but still counts the threshold and the hours', () => {
    const t = advanceTimer(state({ death_scale: 0 }), 20, seq());
    expect(t.checks.map((c) => c.skipped)).toEqual(['unconscious', 'unconscious']);
    expect(t.timer_checks_done).toBe(2);
    expect(t.rest_timer_hours).toBe(20);
  });

  it('knocks out at Втома 6 and stops checking afterwards', () => {
    const t = advanceTimer(state({
      conditions: [{ type: 'fatigue', level: 5 }], rest_timer_hours: 12, timer_checks_done: 1, timer_checks_passed: 1,
    }), 12, seq(face(1, 6)));
    expect(t.checks[0]).toMatchObject({ threshold: 18, success: false, fatigue_after: 6 });
    expect(t.death_scale).toBe(0);
    expect(t.checks[1]).toMatchObject({ threshold: 24, skipped: 'unconscious' });
  });
});
