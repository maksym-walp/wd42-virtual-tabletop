const { resolveHit, resolveDamage, resolveAttack } = require('../attack');

describe('resolveHit — розділи 4.4.1 та 4.4.2', () => {
  const target = { passive_defense: 12, active_defense: 4 }; // загальний захист 16

  it('більше за захист — влучання, зношування на різницю', () => {
    const out = resolveHit({ total: 21, natural: 14, ...target });
    expect(out).toMatchObject({ hit: true, outcome: 'hit', total_defense: 16, wear: 5, passive_after: 7 });
  });

  it('рівно захисту — промах, але пасивний захист падає на 1', () => {
    const out = resolveHit({ total: 16, natural: 10, ...target });
    expect(out).toMatchObject({ hit: false, outcome: 'tie', wear: 1, passive_after: 11 });
  });

  it('менше за захист — промах без зношування', () => {
    const out = resolveHit({ total: 15, natural: 9, ...target });
    expect(out).toMatchObject({ hit: false, outcome: 'miss', wear: 0, passive_after: 12 });
  });

  it('натуральна 20 влучає, навіть коли сумарно захист не перебито', () => {
    const out = resolveHit({ total: 12, natural: 20, ...target });
    expect(out).toMatchObject({ hit: true, outcome: 'natural_hit', natural20: true, wear: 0 });
  });

  it('натуральна 1 промахується, хай яким великим був модифікатор', () => {
    const out = resolveHit({ total: 99, natural: 1, ...target });
    expect(out).toMatchObject({ hit: false, outcome: 'natural_miss', natural1: true, wear: 0 });
  });

  it('пасивний захист не падає нижче нуля', () => {
    const out = resolveHit({ total: 30, natural: 18, passive_defense: 3, active_defense: 0 });
    expect(out).toMatchObject({ wear: 27, passive_after: 0 });
  });

  it('ціль без захисту: влучає будь-що, зношувати нічого', () => {
    const out = resolveHit({ total: 5, natural: 5, passive_defense: 0, active_defense: 0 });
    expect(out).toMatchObject({ hit: true, total_defense: 0, passive_after: 0 });
  });
});

describe('resolveDamage — розділ 4.4.3', () => {
  it('пасивний захист поглинає шкоду, решта йде у здоровʼя', () => {
    expect(resolveDamage({ damage: 20, passive_after: 7 })).toEqual({ damage: 20, absorbed: 7, hp_damage: 13 });
  });

  it('шкода менша за захист поглинається повністю', () => {
    expect(resolveDamage({ damage: 5, passive_after: 7 })).toEqual({ damage: 5, absorbed: 5, hp_damage: 0 });
  });

  it('ціль без пасивного захисту отримує всю шкоду', () => {
    expect(resolveDamage({ damage: 9, passive_after: 0 })).toEqual({ damage: 9, absorbed: 0, hp_damage: 9 });
  });
});

describe('resolveAttack — приклад із книги правил (розділ 4.4.3)', () => {
  // Захист цілі: пасивний 12 + активний 4 = 16. Воїн кидає 21 — влучив.
  // Різниця 5 зносить пасивний з 12 до 7. Шкода 3d8 = 20 → ціль втрачає 13.
  it('повторює приклад крок у крок', () => {
    const out = resolveAttack({ total: 21, natural: 14, passive_defense: 12, active_defense: 4, damage: 20 });
    expect(out).toMatchObject({
      hit: true, total_defense: 16, wear: 5, passive_after: 7, absorbed: 7, hp_damage: 13,
    });
  });

  it('промах шкоди не завдає, але зношування від нічиєї лишається', () => {
    const out = resolveAttack({ total: 16, natural: 10, passive_defense: 12, active_defense: 4, damage: 20 });
    expect(out).toMatchObject({ hit: false, hp_damage: 0, damage: 0, wear: 1, passive_after: 11 });
  });
});
