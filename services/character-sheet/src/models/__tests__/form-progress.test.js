jest.mock('../../config/db');

const { resolveFormTier, tierForKeys } = require('../form-progress');

const tiered = ['primitive', 'full', 'perfected'];
const untiered = [];

describe('tierForKeys', () => {
  it('gives the highest granted tier', () => {
    expect(tierForKeys(['primitive', 'main'], tiered)).toBe('full');
    expect(tierForKeys(null, tiered)).toBe('perfected');
  });

  it('falls back to full when none of the granted keys are a tier of this entry', () => {
    expect(tierForKeys(['gone'], tiered)).toBe('full');
  });

  it('returns null for an entry without tiers', () => {
    expect(tierForKeys(null, untiered)).toBeNull();
    expect(tierForKeys(['primitive'], untiered)).toBeNull();
  });
});

describe('resolveFormTier', () => {
  it('lets the current tier stay even above what the tree opens', () => {
    const { form_tier } = resolveFormTier(tiered, { form_tier: 'perfected' }, { allowed: ['primitive'], current: { form_tier: 'perfected' } });
    expect(form_tier).toBe('perfected');
  });

  it('caps a raised tier at the highest opened form', () => {
    const { form_tier } = resolveFormTier(tiered, { form_tier: 'perfected' }, { allowed: ['primitive'], current: { form_tier: 'primitive' } });
    expect(form_tier).toBe('primitive');
  });

  it('does not restrict anything when every form is allowed', () => {
    const { form_tier } = resolveFormTier(tiered, { form_tier: 'perfected' }, { allowed: null });
    expect(form_tier).toBe('perfected');
  });

  it('rejects a tier the entry does not have', () => {
    const { error } = resolveFormTier(tiered, { form_tier: 'bogus' });
    expect(error).toMatch(/Некоректна/);
  });

  it('defaults to the lowest tier on add when form_tier is omitted', () => {
    const { form_tier } = resolveFormTier(tiered, {}, { isAdd: true });
    expect(form_tier).toBe('primitive');
  });

  it('returns nothing when form_tier is omitted outside of add', () => {
    expect(resolveFormTier(tiered, {})).toEqual({});
  });
});
