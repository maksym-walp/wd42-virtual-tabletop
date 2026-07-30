const { deriveCombatStats, ATTRIBUTE_DIE_SIZE, HEALTH_DIE_SIZE, HEALTH_DICE_COUNT_BY_BODY } = require('../compendium-combat-stats');

describe('deriveCombatStats', () => {
  it('computes maxHealth from health_die x body-derived dice count', () => {
    // body=3 -> 15 dice (HEALTH_DICE_COUNT_BY_BODY), health_die=d8 -> avg 4.5
    expect(deriveCombatStats({ body: 3, dexterity: 3, health_die: 'd8' })).toEqual({
      maxHealth: 68, activeDefense: 15, initiative: 5,
    });
  });

  it('derives activeDefense/initiative from dexterity independently of health_die', () => {
    const stats = deriveCombatStats({ body: 1, dexterity: 1, health_die: 'd4' });
    expect(stats.activeDefense).toBe(13); // dexterity=1 -> d4, 10 + avg(2.5)
    expect(stats.initiative).toBe(3); // dexterity=1 -> d4, avg(2.5)
  });

  it('scales maxHealth up with a bigger health_die for the same body', () => {
    const small = deriveCombatStats({ body: 3, dexterity: 1, health_die: 'd4' });
    const big = deriveCombatStats({ body: 3, dexterity: 1, health_die: 'd20' });
    expect(big.maxHealth).toBeGreaterThan(small.maxHealth);
  });

  it('scales maxHealth up with a higher body for the same health_die', () => {
    const weak = deriveCombatStats({ body: 1, dexterity: 1, health_die: 'd8' });
    const strong = deriveCombatStats({ body: 6, dexterity: 1, health_die: 'd8' });
    expect(strong.maxHealth).toBeGreaterThan(weak.maxHealth);
  });

  it('falls back to a d6 health_die when missing (entry has neither species nor subspecies)', () => {
    const withD6 = deriveCombatStats({ body: 2, dexterity: 1, health_die: 'd6' });
    const withMissing = deriveCombatStats({ body: 2, dexterity: 1, health_die: undefined });
    expect(withMissing).toEqual(withD6);
  });

  it('falls back to the d4 dexterity baseline for an out-of-range attribute', () => {
    expect(deriveCombatStats({ body: 0, dexterity: undefined, health_die: 'd4' })).toEqual({
      maxHealth: 15, activeDefense: 13, initiative: 3,
    });
  });

  it('uses the persisted rolled_health as maxHealth for an npc, ignoring the average formula', () => {
    const stats = deriveCombatStats({ body: 3, dexterity: 3, health_die: 'd8', entity_type: 'npc', rolled_health: 143 });
    expect(stats.maxHealth).toBe(143);
    // activeDefense/initiative are unaffected — still dexterity-derived
    expect(stats.activeDefense).toBe(15);
    expect(stats.initiative).toBe(5);
  });

  it('falls back to the average formula for an npc that has never been rolled', () => {
    const rolled = deriveCombatStats({ body: 3, dexterity: 3, health_die: 'd8', entity_type: 'npc', rolled_health: null });
    const unrolled = deriveCombatStats({ body: 3, dexterity: 3, health_die: 'd8' }); // no entity_type/rolled_health at all
    expect(rolled.maxHealth).toBe(68); // same average as a creature would get
    expect(rolled).toEqual(unrolled);
  });

  it('ignores rolled_health for a creature — always uses the average formula', () => {
    const stats = deriveCombatStats({ body: 3, dexterity: 3, health_die: 'd8', entity_type: 'creature', rolled_health: 999 });
    expect(stats.maxHealth).toBe(68); // not 999 — creatures have no persistent health
  });

  it('ATTRIBUTE_DIE_SIZE matches the compendium skill-dice ladder', () => {
    expect(ATTRIBUTE_DIE_SIZE).toEqual({ 1: 4, 2: 6, 3: 8, 4: 10, 5: 12, 6: 20 });
  });

  it('HEALTH_DIE_SIZE covers every species health_die option', () => {
    expect(HEALTH_DIE_SIZE).toEqual({ d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 });
  });

  it('HEALTH_DICE_COUNT_BY_BODY matches compendium entry.dto.js exactly', () => {
    expect(HEALTH_DICE_COUNT_BY_BODY).toEqual({ 1: 6, 2: 11, 3: 15, 4: 18, 5: 20, 6: 21 });
  });
});
