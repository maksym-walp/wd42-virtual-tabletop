const { sanitizeCastSkillOptions } = require('../node-cast-skill');

const shape = (list) => list.map(({ id, ...rest }) => rest);
const FORM = 'pact';

describe('sanitizeCastSkillOptions', () => {
  it('keeps a plain magic-form/skill option', () => {
    expect(shape(sanitizeCastSkillOptions([{ magic_form: FORM, skill_key: 'will' }]))).toEqual([
      { magic_form: FORM, skill_key: 'will', note: '' },
    ]);
  });

  it('drops an entry with a missing/unknown magic_form', () => {
    expect(sanitizeCastSkillOptions([
      { magic_form: 'not-a-form', skill_key: 'will' },
      { skill_key: 'will' },
      null,
      'not an object',
    ])).toEqual([]);
  });

  it('drops an entry with an unknown or combat-only skill_key', () => {
    expect(sanitizeCastSkillOptions([
      { magic_form: FORM, skill_key: 'flying' },
      { magic_form: FORM, skill_key: 'attack' },
      { magic_form: FORM },
    ])).toEqual([]);
  });

  it('keeps a supplied id and trims the note', () => {
    const [opt] = sanitizeCastSkillOptions([
      { id: 'row-1', magic_form: FORM, skill_key: 'deception', note: '  Боржник  ' },
    ]);
    expect(opt).toMatchObject({ id: 'row-1', skill_key: 'deception', note: 'Боржник' });
  });

  it('two different nodes may grant different skills for the same magic form', () => {
    const borzhnyk = sanitizeCastSkillOptions([{ magic_form: FORM, skill_key: 'deception' }]);
    const poserednyk = sanitizeCastSkillOptions([{ magic_form: FORM, skill_key: 'persuasion' }]);
    expect(borzhnyk[0].skill_key).toBe('deception');
    expect(poserednyk[0].skill_key).toBe('persuasion');
  });

  it('returns an empty list for anything that is not an array', () => {
    expect(sanitizeCastSkillOptions(undefined)).toEqual([]);
    expect(sanitizeCastSkillOptions(null)).toEqual([]);
    expect(sanitizeCastSkillOptions('will')).toEqual([]);
  });
});
