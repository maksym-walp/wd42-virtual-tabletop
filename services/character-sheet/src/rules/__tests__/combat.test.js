const { applyDamage, applyDeathSave } = require('../combat');
const { makeSkills, makeCharacter } = require('../__helpers__/rules');

// Тілобудова 2 → 11 кубиків по 5 = поточний максимум 55 без станів.
const skills = makeSkills();
const hero = (over = {}) => makeCharacter({ current_hp: 55, temp_hp: 0, ...over });

describe('applyDamage', () => {
  it('знімає здоровʼя і рахує поточний максимум', () => {
    const out = applyDamage(hero(), skills, 10);
    expect(out).toMatchObject({ max_hp: 55, hp_before: 55, hp_after: 45, hp_lost: 10 });
  });

  it('тимчасове здоровʼя приймає удар першим', () => {
    const out = applyDamage(hero({ temp_hp: 4 }), skills, 10);
    expect(out).toMatchObject({ temp_before: 4, temp_after: 0, hp_after: 49 });
  });

  it('тимчасового здоровʼя може вистачити на весь удар', () => {
    const out = applyDamage(hero({ temp_hp: 12 }), skills, 10);
    expect(out).toMatchObject({ temp_after: 2, hp_after: 55, hp_lost: 0 });
  });

  it('не пропонує Травму від удару, меншого за половину максимуму', () => {
    expect(applyDamage(hero(), skills, 27).trauma_suggested).toBe(false);
  });

  it('пропонує Травму від половини поточного максимуму (5.2.3)', () => {
    expect(applyDamage(hero(), skills, 28).trauma_suggested).toBe(true);
  });

  it('більша шкода рівнів Травми не додає — пропозиція лишається одна', () => {
    const out = applyDamage(hero(), skills, 50);
    expect(out.trauma_suggested).toBe(true);
    expect(out.massive).toBe(false);
  });

  it('падіння на 0 ставить маркер шкали смерті на 0 (5.3.1)', () => {
    const out = applyDamage(hero(), skills, 55);
    expect(out).toMatchObject({ hp_after: 0, fell: true, death_scale: 0, massive: false });
  });

  it('масивна шкода — удвічі більша за максимум — додає один провал', () => {
    const out = applyDamage(hero(), skills, 110);
    expect(out).toMatchObject({ massive: true, fell: true, death_scale: -1 });
  });

  it('удар по непритомному здоровʼя не знижує, а замальовує провал (5.3.4)', () => {
    const out = applyDamage(hero({ current_hp: 0, death_scale: 0 }), skills, 30);
    expect(out).toMatchObject({
      unconscious_hit: true, hp_after: 0, hp_lost: 0, death_scale: -1, trauma_suggested: false,
    });
  });

  it('маркер не падає нижче −3', () => {
    const out = applyDamage(hero({ current_hp: 0, death_scale: -3 + 1 }), skills, 5);
    expect(out.death_scale).toBe(-3);
  });

  it('нульова шкода нічого не змінює', () => {
    const out = applyDamage(hero(), skills, 0);
    expect(out).toMatchObject({ hp_after: 55, fell: false, death_scale: null, trauma_suggested: false });
  });

  it('стани знижують поточний максимум, а з ним і поріг Травми', () => {
    // Втома 3 закреслює три найбільші кубики → максимум 40, половина — 20.
    const sick = hero({ conditions: [{ type: 'fatigue', level: 3 }] });
    const out = applyDamage(sick, skills, 20);
    expect(out.max_hp).toBe(40);
    expect(out.trauma_suggested).toBe(true);
  });
});

describe('applyDeathSave', () => {
  it('7 і більше — успіх, маркер вгору', () => {
    expect(applyDeathSave(hero({ death_scale: 0 }), 7)).toMatchObject({ success: true, death_scale: 1 });
  });

  it('6 і менше — провал, маркер вниз', () => {
    expect(applyDeathSave(hero({ death_scale: 0 }), 6)).toMatchObject({ success: false, death_scale: -1 });
  });

  it('на +3 персонаж отямлюється', () => {
    expect(applyDeathSave(hero({ death_scale: 2 }), 12)).toMatchObject({ death_scale: 3, awake: true });
  });

  it('на −3 персонаж помирає', () => {
    expect(applyDeathSave(hero({ death_scale: -2 }), 1)).toMatchObject({ death_scale: -3, dead: true });
  });

  it('натуральні 12 і 1 особливими не є — правило 1.1.3 тут не діє', () => {
    expect(applyDeathSave(hero({ death_scale: 0 }), 12).success).toBe(true);
    expect(applyDeathSave(hero({ death_scale: 0 }), 1).success).toBe(false);
  });

  it('персонаж не на шкалі смерті кидків не робить', () => {
    expect(applyDeathSave(hero({ death_scale: null }), 10)).toBeNull();
    expect(applyDeathSave(hero({ death_scale: 3 }), 10)).toBeNull();
    expect(applyDeathSave(hero({ death_scale: -3 }), 10)).toBeNull();
  });
});
