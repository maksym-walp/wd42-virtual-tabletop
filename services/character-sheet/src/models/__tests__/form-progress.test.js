jest.mock('../../config/db');

const { progressForKeys, resolveFormProgress } = require('../form-progress');

const tiered = { tierKinds: ['primitive', 'perfected'], altIds: [] };
const alternative = { tierKinds: [], altIds: ['alt-1', 'alt-2'] };

describe('progressForKeys', () => {
  it('gives the highest granted tier', () => {
    expect(progressForKeys(['primitive', 'main'], tiered)).toEqual({ form_tier: 'full', primary_form: 'main', mastered_forms: ['main'] });
    expect(progressForKeys(null, tiered).form_tier).toBe('perfected');
  });

  it('masters the granted alternative forms, the first one primary', () => {
    expect(progressForKeys(['alt-2'], alternative)).toEqual({ form_tier: null, primary_form: 'alt-2', mastered_forms: ['alt-2'] });
    expect(progressForKeys(null, alternative).mastered_forms).toEqual(['main', 'alt-1', 'alt-2']);
  });

  it('falls back to the main form for keys the entry no longer has', () => {
    expect(progressForKeys(['gone'], alternative)).toEqual({ form_tier: null, primary_form: 'main', mastered_forms: ['main'] });
    expect(progressForKeys(['gone'], tiered).form_tier).toBe('full');
  });
});

describe('resolveFormProgress', () => {
  it('lets the current tier stay even above what the tree opens', () => {
    const { progress } = resolveFormProgress(tiered, { form_tier: 'perfected' }, { allowed: ['primitive'], current: { form_tier: 'perfected' } });
    expect(progress.form_tier).toBe('perfected');
  });

  it('caps a raised tier at the highest opened form', () => {
    const { progress } = resolveFormProgress(tiered, { form_tier: 'perfected' }, { allowed: ['primitive'], current: { form_tier: 'primitive' } });
    expect(progress.form_tier).toBe('primitive');
  });

  it('does not restrict anything when every form is allowed', () => {
    const { progress } = resolveFormProgress(alternative, { primary_form: 'alt-2', mastered_forms: ['alt-2', 'alt-1'] }, { allowed: null });
    expect(progress).toEqual({ primary_form: 'alt-2', mastered_forms: ['alt-2', 'alt-1'] });
  });
});
