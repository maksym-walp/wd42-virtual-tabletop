const { sanitizeModifiers, TARGETS } = require('../node-modifier');

// Беремо лише поля, що описують сам модифікатор: id генерується випадково.
const shape = (list) => list.map(({ id, ...rest }) => rest);

describe('sanitizeModifiers', () => {
  it('keeps a plain roll-mode modifier on a skill', () => {
    expect(shape(sanitizeModifiers([{ target: 'intuition', mode: 'adv' }]))).toEqual([
      { target: 'intuition', mode: 'adv', value: 0, situational: false, note: '' },
    ]);
  });

  it('covers all 20 skills and the six combat targets', () => {
    expect(TARGETS).toHaveLength(26);
    expect(TARGETS).toEqual(expect.arrayContaining([
      'evasion', 'persuasion', 'initiative', 'attack', 'damage_dice',
      'death_save', 'endurance_timer', 'immunity_check',
    ]));
  });

  it('drops entries with an unknown target or mode', () => {
    expect(sanitizeModifiers([
      { target: 'flying', mode: 'adv' },
      { target: 'will', mode: 'superb' },
      { target: 'will' },
      'not an object',
      null,
    ])).toEqual([]);
  });

  it('allows only a dice bonus on damage_dice — it has no roll mode', () => {
    expect(shape(sanitizeModifiers([
      { target: 'damage_dice', mode: 'adv' },
      { target: 'damage_dice', mode: 'bonus', value: 1 },
    ]))).toEqual([
      { target: 'damage_dice', mode: 'bonus', value: 1, situational: false, note: '' },
    ]);
  });

  it('coerces a numeric string bonus and drops a bonus of zero', () => {
    const out = sanitizeModifiers([
      { target: 'attack', mode: 'bonus', value: '2' },
      { target: 'attack', mode: 'bonus', value: 0 },
      { target: 'attack', mode: 'bonus', value: 'не число' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe(2);
  });

  it('keeps a negative flat bonus but normalizes the sign of a rank shift', () => {
    const out = sanitizeModifiers([
      { target: 'evasion', mode: 'bonus', value: -2 },
      { target: 'evasion', mode: 'rank_down', value: -1 },
    ]);
    expect(out.map((m) => m.value)).toEqual([-2, 1]);
  });

  it('clamps an absurd value and trims the note', () => {
    const [mod] = sanitizeModifiers([
      { target: 'strength', mode: 'bonus', value: 9999, note: '  проти звірів  ', situational: true },
    ]);
    expect(mod).toMatchObject({ value: 20, note: 'проти звірів', situational: true });
  });

  it('keeps a supplied id so editing a row does not remount it', () => {
    const [mod] = sanitizeModifiers([{ id: 'row-1', target: 'will', mode: 'dis' }]);
    expect(mod.id).toBe('row-1');
  });

  it('returns an empty list for anything that is not an array', () => {
    expect(sanitizeModifiers(undefined)).toEqual([]);
    expect(sanitizeModifiers(null)).toEqual([]);
    expect(sanitizeModifiers('adv')).toEqual([]);
  });
});
