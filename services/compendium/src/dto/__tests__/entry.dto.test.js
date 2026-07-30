const { decorateEntry, ATTRIBUTE_DICE_RANK, HEALTH_DICE_COUNT_BY_BODY, SKILLS } = require('../entry.dto');

describe('ATTRIBUTE_DICE_RANK', () => {
  it('matches the spec examples: 1 -> d4, 3 -> d8', () => {
    expect(ATTRIBUTE_DICE_RANK[1]).toBe('d4');
    expect(ATTRIBUTE_DICE_RANK[3]).toBe('d8');
  });

  it('is a full 1..6 ladder', () => {
    expect(ATTRIBUTE_DICE_RANK).toEqual({ 1: 'd4', 2: 'd6', 3: 'd8', 4: 'd10', 5: 'd12', 6: 'd20' });
  });
});

describe('HEALTH_DICE_COUNT_BY_BODY', () => {
  it('matches the frontend PHYSIQUE_HEALTH table exactly', () => {
    expect(HEALTH_DICE_COUNT_BY_BODY).toEqual({ 1: 6, 2: 11, 3: 15, 4: 18, 5: 20, 6: 21 });
  });
});

describe('SKILLS', () => {
  it('has exactly 20 skills, 4 per attribute', () => {
    expect(SKILLS).toHaveLength(20);
    const byAttribute = SKILLS.reduce((acc, s) => {
      acc[s.attribute] = (acc[s.attribute] || 0) + 1;
      return acc;
    }, {});
    expect(byAttribute).toEqual({ dexterity: 4, body: 4, intelligence: 4, wisdom: 4, charisma: 4 });
  });
});

describe('decorateEntry', () => {
  const entry = { id: 'e1', name: 'Old Tom', dexterity: 3, body: 4, intelligence: 2, wisdom: 5, charisma: 1, health_die: 'd10' };

  it('appends a skills array without mutating the original fields', () => {
    const result = decorateEntry(entry);
    expect(result).toMatchObject(entry);
    expect(result.skills).toHaveLength(20);
  });

  it('derives dice per attribute per the spec example (dexterity 3 -> d8)', () => {
    const result = decorateEntry(entry);
    const dexSkills = result.skills.filter((s) => s.attribute === 'dexterity');
    expect(dexSkills).toHaveLength(4);
    dexSkills.forEach((s) => expect(s.dice).toBe('d8'));
  });

  it('derives dice per the spec example (attribute 1 -> d4)', () => {
    const result = decorateEntry(entry);
    const chaSkills = result.skills.filter((s) => s.attribute === 'charisma');
    chaSkills.forEach((s) => expect(s.dice).toBe('d4'));
  });

  it('appends health: the joined health_die x the body-derived dice count, rolled null when never rolled', () => {
    const result = decorateEntry(entry);
    expect(result.health).toEqual({ die: 'd10', count: 18, formula: '18d10', rolled: null });
  });

  it('falls back to d6 when health_die is missing (entry has neither species nor subspecies)', () => {
    const result = decorateEntry({ ...entry, health_die: null });
    expect(result.health.die).toBe('d6');
    expect(result.health.formula).toBe('18d6');
  });

  it('surfaces a persisted rolled_health as health.rolled (NPCs)', () => {
    const result = decorateEntry({ ...entry, entity_type: 'npc', rolled_health: 143 });
    expect(result.health.rolled).toBe(143);
  });

  it('rolled is always null for creatures (rolled_health never set)', () => {
    const result = decorateEntry({ ...entry, entity_type: 'creature', rolled_health: null });
    expect(result.health.rolled).toBeNull();
  });

  it('passes through null/undefined entries untouched', () => {
    expect(decorateEntry(null)).toBeNull();
    expect(decorateEntry(undefined)).toBeUndefined();
  });
});
