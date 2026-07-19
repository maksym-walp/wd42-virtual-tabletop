jest.mock('../../models/spell.model');
jest.mock('../../models/prerequisite.model');
jest.mock('../authorize-character-write');

const SpellProgressModel = require('../../models/spell.model');
const { checkPrerequisites, isVisibleToUser } = require('../../models/prerequisite.model');
const authorizeCharacterWrite = require('../authorize-character-write');
const SpellController = require('../spell.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq(overrides = {}) {
  return { params: {}, body: {}, user: { sub: 'user-1' }, ...overrides };
}

beforeEach(() => jest.clearAllMocks());

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
    expect(checkPrerequisites).not.toHaveBeenCalled();
  });

  it('403s with missing_node_ids when prerequisites are unmet', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    isVisibleToUser.mockResolvedValue(true);
    checkPrerequisites.mockResolvedValue({ met: false, missing: ['node-1'] });
    const req = mockReq({ params: { id: 'c1' }, body: { spell_id: 's1' } });
    const res = mockRes();

    await SpellController.add(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Не виконано вимоги дерева розвитку', missing_node_ids: ['node-1'],
    });
    expect(SpellProgressModel.add).not.toHaveBeenCalled();
  });

  it('201s and adds the spell when visible and prerequisites are met', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    isVisibleToUser.mockResolvedValue(true);
    checkPrerequisites.mockResolvedValue({ met: true, missing: [] });
    SpellProgressModel.add.mockResolvedValue({ id: 'link-1', spell_id: 's1' });
    const req = mockReq({ params: { id: 'c1' }, body: { spell_id: 's1' } });
    const res = mockRes();

    await SpellController.add(req, res);

    expect(SpellProgressModel.add).toHaveBeenCalledWith('c1', 's1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ spell: { id: 'link-1', spell_id: 's1' } });
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
