jest.mock('../../models/spell.model');
jest.mock('../../models/prerequisite.model');
jest.mock('../../models/spell-access.model');
jest.mock('../authorize-character-write');

const SpellProgressModel = require('../../models/spell.model');
const { isVisibleToUser } = require('../../models/prerequisite.model');
const { checkSpellAccess, isSpellMaster } = require('../../models/spell-access.model');
const authorizeCharacterWrite = require('../authorize-character-write');
const SpellController = require('../spell.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq(overrides = {}) {
  return { params: {}, body: {}, user: { sub: 'user-1' }, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  isSpellMaster.mockResolvedValue(false);
  checkSpellAccess.mockResolvedValue({ met: true, allowedForms: null, missing: {} });
});

describe('SpellController.list', () => {
  it('lists spells for the character without an auth check', async () => {
    SpellProgressModel.findAll.mockResolvedValue([{ id: 's1' }]);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await SpellController.list(req, res);

    expect(SpellProgressModel.findAll).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ spells: [{ id: 's1' }] });
  });
});

describe('SpellController.add', () => {
  it('stops without further calls when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { spell_id: 's1' } });
    const res = mockRes();

    await SpellController.add(req, res);

    expect(isVisibleToUser).not.toHaveBeenCalled();
    expect(SpellProgressModel.add).not.toHaveBeenCalled();
  });

  it('400s when spell_id is missing', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: {} });
    const res = mockRes();

    await SpellController.add(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(isVisibleToUser).not.toHaveBeenCalled();
  });

  it('404s when the spell is not visible to the user', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    isVisibleToUser.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' }, body: { spell_id: 's1' }, user: { sub: 'u1' } });
    const res = mockRes();

    await SpellController.add(req, res);

    expect(isVisibleToUser).toHaveBeenCalledWith('spellbook.spells', 's1', 'u1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(checkSpellAccess).not.toHaveBeenCalled();
  });

  it('403s with what is missing when the tree has not opened the tradition/complexity', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    isVisibleToUser.mockResolvedValue(true);
    checkSpellAccess.mockResolvedValue({ met: false, allowedForms: [], missing: { traditionIds: ['t1'] } });
    const req = mockReq({ params: { id: 'c1' }, body: { spell_id: 's1' } });
    const res = mockRes();

    await SpellController.add(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Традицію чи складність заклинання ще не відкрито на дереві розвитку', missing: { traditionIds: ['t1'] },
    });
    expect(SpellProgressModel.add).not.toHaveBeenCalled();
  });

  it('lets a master add any spell, marking it gm_granted', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    isVisibleToUser.mockResolvedValue(true);
    isSpellMaster.mockResolvedValue(true);
    SpellProgressModel.formKeys.mockResolvedValue({ tierKinds: [], altIds: [] });
    const req = mockReq({ params: { id: 'c1' }, body: { spell_id: 's1' } });
    const res = mockRes();

    await SpellController.add(req, res);

    expect(checkSpellAccess).not.toHaveBeenCalled();
    expect(SpellProgressModel.add).toHaveBeenCalledWith('c1', 's1', { form_tier: null, primary_form: 'main', mastered_forms: ['main'], gm_granted: true });
  });

  it('limits a player to the forms whose complexity the tree opened', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    isVisibleToUser.mockResolvedValue(true);
    checkSpellAccess.mockResolvedValue({ met: true, allowedForms: ['primitive'], missing: {} });
    SpellProgressModel.formKeys.mockResolvedValue({ tierKinds: ['primitive', 'perfected'], altIds: [] });
    const req = mockReq({ params: { id: 'c1' }, body: { spell_id: 's1', form_tier: 'perfected' } });

    await SpellController.add(req, mockRes());

    expect(SpellProgressModel.add.mock.calls[0][2]).toMatchObject({ form_tier: 'primitive', gm_granted: false });
  });

  it('201s and adds the spell when visible and prerequisites are met', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    isVisibleToUser.mockResolvedValue(true);
    SpellProgressModel.formKeys.mockResolvedValue({ tierKinds: [], altIds: [] });
    SpellProgressModel.add.mockResolvedValue({ id: 'link-1', spell_id: 's1' });
    const req = mockReq({ params: { id: 'c1' }, body: { spell_id: 's1' } });
    const res = mockRes();

    await SpellController.add(req, res);

    expect(SpellProgressModel.add).toHaveBeenCalledWith('c1', 's1', { form_tier: null, primary_form: 'main', mastered_forms: ['main'], gm_granted: false });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ spell: { id: 'link-1', spell_id: 's1' } });
  });
});

describe('SpellController.add forms', () => {
  beforeEach(() => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    isVisibleToUser.mockResolvedValue(true);
    SpellProgressModel.formKeys.mockResolvedValue({ tierKinds: ['primitive', 'perfected'], altIds: ['alt-1'] });
  });

  it('adds with the chosen tier', async () => {
    const req = mockReq({ params: { id: 'c1' }, body: { spell_id: 's1', form_tier: 'perfected' } });
    await SpellController.add(req, mockRes());
    expect(SpellProgressModel.add).toHaveBeenCalledWith('c1', 's1', {
      form_tier: 'perfected', primary_form: 'main', mastered_forms: ['main'], gm_granted: false,
    });
  });

  it('defaults the tier to the lowest existing one', async () => {
    SpellProgressModel.formKeys.mockResolvedValueOnce({ tierKinds: ['perfected'], altIds: [] });
    const req = mockReq({ params: { id: 'c1' }, body: { spell_id: 's1' } });
    await SpellController.add(req, mockRes());
    expect(SpellProgressModel.add.mock.calls[0][2].form_tier).toBe('full');
  });

  it('400s for a tier the spell does not have', async () => {
    SpellProgressModel.formKeys.mockResolvedValueOnce({ tierKinds: [], altIds: [] });
    const req = mockReq({ params: { id: 'c1' }, body: { spell_id: 's1', form_tier: 'full' } });
    const res = mockRes();
    await SpellController.add(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(SpellProgressModel.add).not.toHaveBeenCalled();
  });

  it('400s for an unknown primary form', async () => {
    const req = mockReq({ params: { id: 'c1' }, body: { spell_id: 's1', primary_form: 'nope' } });
    const res = mockRes();
    await SpellController.add(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('SpellController.patch forms', () => {
  beforeEach(() => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    SpellProgressModel.formKeys.mockResolvedValue({ tierKinds: [], altIds: ['alt-1'] });
    SpellProgressModel.patch.mockResolvedValue({ spell_id: 's1' });
  });

  it('drops unknown keys from mastered_forms and passes the rest through', async () => {
    const req = mockReq({ params: { id: 'c1', spellId: 's1' }, body: { primary_form: 'alt-1', mastered_forms: ['alt-1', 'ghost', 'alt-1'] } });
    await SpellController.patch(req, mockRes());
    expect(SpellProgressModel.patch).toHaveBeenCalledWith('c1', 's1', {
      mastered: undefined, cast_count: undefined, primary_form: 'alt-1', mastered_forms: ['alt-1'],
    });
  });

  it('ignores the tree for a spell the master gave', async () => {
    SpellProgressModel.findOne.mockResolvedValue({ gm_granted: true, mastered_forms: ['main'] });
    checkSpellAccess.mockResolvedValue({ met: false, allowedForms: [], missing: {} });
    const req = mockReq({ params: { id: 'c1', spellId: 's1' }, body: { primary_form: 'alt-1' } });
    await SpellController.patch(req, mockRes());
    expect(checkSpellAccess).not.toHaveBeenCalled();
    expect(SpellProgressModel.patch.mock.calls[0][2]).toMatchObject({ primary_form: 'alt-1' });
  });

  it('does not look up forms for a plain mastered/cast_count patch', async () => {
    const req = mockReq({ params: { id: 'c1', spellId: 's1' }, body: { cast_count: 2 } });
    await SpellController.patch(req, mockRes());
    expect(SpellProgressModel.formKeys).not.toHaveBeenCalled();
  });
});

describe('SpellController.patch', () => {
  it('stops without touching the model when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', spellId: 's1' }, body: { mastered: true } });
    const res = mockRes();

    await SpellController.patch(req, res);

    expect(SpellProgressModel.patch).not.toHaveBeenCalled();
  });

  it('404s when the spell is not in the sheet', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    SpellProgressModel.patch.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', spellId: 's1' }, body: {} });
    const res = mockRes();

    await SpellController.patch(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('patches and returns the spell on success', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    SpellProgressModel.patch.mockResolvedValue({ id: 'link-1', mastered: true, cast_count: 2 });
    const req = mockReq({ params: { id: 'c1', spellId: 's1' }, body: { mastered: true, cast_count: 2 } });
    const res = mockRes();

    await SpellController.patch(req, res);

    expect(SpellProgressModel.patch).toHaveBeenCalledWith('c1', 's1', { mastered: true, cast_count: 2 });
    expect(res.json).toHaveBeenCalledWith({ spell: { id: 'link-1', mastered: true, cast_count: 2 } });
  });
});

describe('SpellController.remove', () => {
  it('stops without touching the model when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', spellId: 's1' } });
    const res = mockRes();

    await SpellController.remove(req, res);

    expect(SpellProgressModel.remove).not.toHaveBeenCalled();
  });

  it('404s when nothing was removed', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    SpellProgressModel.remove.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', spellId: 's1' } });
    const res = mockRes();

    await SpellController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('confirms removal on success', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    SpellProgressModel.remove.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', spellId: 's1' } });
    const res = mockRes();

    await SpellController.remove(req, res);

    expect(SpellProgressModel.remove).toHaveBeenCalledWith('c1', 's1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});
