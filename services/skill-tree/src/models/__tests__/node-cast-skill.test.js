const { sanitizeCastSkillOptions } = require('../node-cast-skill');

const shape = (list) => list.map(({ id, ...rest }) => rest);
const TRADITION = '11111111-2222-3333-4444-555555555555';

describe('sanitizeCastSkillOptions', () => {
  it('keeps a plain tradition/skill option', () => {
    expect(shape(sanitizeCastSkillOptions([{ tradition_id: TRADITION, skill_key: 'will' }]))).toEqual([
      { tradition_id: TRADITION, skill_key: 'will', note: '' },
    ]);
  });

  it('drops an entry with a missing/invalid tradition_id', () => {
    expect(sanitizeCastSkillOptions([
      { tradition_id: 'not-a-uuid', skill_key: 'will' },
      { skill_key: 'will' },
      null,
      'not an object',
    ])).toEqual([]);
  });

  it('drops an entry with an unknown or combat-only skill_key', () => {
    expect(sanitizeCastSkillOptions([
      { tradition_id: TRADITION, skill_key: 'flying' },
      { tradition_id: TRADITION, skill_key: 'attack' },
      { tradition_id: TRADITION },
    ])).toEqual([]);
  });

  it('keeps a supplied id and trims the note', () => {
    const [opt] = sanitizeCastSkillOptions([
      { id: 'row-1', tradition_id: TRADITION, skill_key: 'deception', note: '  Боржник  ' },
    ]);
    expect(opt).toMatchObject({ id: 'row-1', skill_key: 'deception', note: 'Боржник' });
  });

  it('two different nodes may grant different skills for the same tradition', () => {
    const borzhnyk = sanitizeCastSkillOptions([{ tradition_id: TRADITION, skill_key: 'deception' }]);
    const poserednyk = sanitizeCastSkillOptions([{ tradition_id: TRADITION, skill_key: 'persuasion' }]);
    expect(borzhnyk[0].skill_key).toBe('deception');
    expect(poserednyk[0].skill_key).toBe('persuasion');
  });

  it('returns an empty list for anything that is not an array', () => {
    expect(sanitizeCastSkillOptions(undefined)).toEqual([]);
    expect(sanitizeCastSkillOptions(null)).toEqual([]);
    expect(sanitizeCastSkillOptions('will')).toEqual([]);
  });
});
