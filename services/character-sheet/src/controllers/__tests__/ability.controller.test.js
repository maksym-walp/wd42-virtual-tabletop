jest.mock('../../models/ability.model');
jest.mock('../../models/prerequisite.model');
jest.mock('../authorize-character-write');

const AbilityModel = require('../../models/ability.model');
const { checkPrerequisites, isVisibleToUser } = require('../../models/prerequisite.model');
const authorizeCharacterWrite = require('../authorize-character-write');
const AbilityController = require('../ability.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq(overrides = {}) {
  return { params: {}, body: {}, user: { sub: 'user-1' }, ...overrides };
}

beforeEach(() => jest.clearAllMocks());

describe('AbilityController.list', () => {
  it('lists abilities for the character without an auth check', async () => {
    AbilityModel.findAll.mockResolvedValue([{ id: 'a1' }]);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await AbilityController.list(req, res);

    expect(AbilityModel.findAll).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ abilities: [{ id: 'a1' }] });
  });
});

describe('AbilityController.add', () => {
  it('stops without further calls when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { ability_id: 'a1' } });
    const res = mockRes();

    await AbilityController.add(req, res);

    expect(isVisibleToUser).not.toHaveBeenCalled();
    expect(AbilityModel.add).not.toHaveBeenCalled();
  });

  it('400s when ability_id is missing', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: {} });
    const res = mockRes();

    await AbilityController.add(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(isVisibleToUser).not.toHaveBeenCalled();
  });

  it('404s when the ability is not visible to the user', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    isVisibleToUser.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' }, body: { ability_id: 'a1' }, user: { sub: 'u1' } });
    const res = mockRes();

    await AbilityController.add(req, res);

    expect(isVisibleToUser).toHaveBeenCalledWith('abilities.entries', 'a1', 'u1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(checkPrerequisites).not.toHaveBeenCalled();
  });

  it('403s with missing_node_ids when prerequisites are unmet', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    isVisibleToUser.mockResolvedValue(true);
    checkPrerequisites.mockResolvedValue({ met: false, missing: ['node-1', 'node-2'] });
    const req = mockReq({ params: { id: 'c1' }, body: { ability_id: 'a1' } });
    const res = mockRes();

    await AbilityController.add(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Не виконано вимоги дерева розвитку', missing_node_ids: ['node-1', 'node-2'],
    });
    expect(AbilityModel.add).not.toHaveBeenCalled();
  });

  it('201s and adds the ability when visible and prerequisites are met', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    isVisibleToUser.mockResolvedValue(true);
    checkPrerequisites.mockResolvedValue({ met: true, missing: [] });
    AbilityModel.add.mockResolvedValue({ id: 'link-1', ability_id: 'a1' });
    const req = mockReq({ params: { id: 'c1' }, body: { ability_id: 'a1' } });
    const res = mockRes();

    await AbilityController.add(req, res);

    expect(AbilityModel.add).toHaveBeenCalledWith('c1', 'a1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ ability: { id: 'link-1', ability_id: 'a1' } });
  });
});

describe('AbilityController.remove', () => {
  it('stops without touching the model when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', abilityId: 'a1' } });
    const res = mockRes();

    await AbilityController.remove(req, res);

    expect(AbilityModel.remove).not.toHaveBeenCalled();
  });

  it('404s when nothing was removed', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    AbilityModel.remove.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', abilityId: 'a1' } });
    const res = mockRes();

    await AbilityController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('confirms removal on success', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    AbilityModel.remove.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', abilityId: 'a1' } });
    const res = mockRes();

    await AbilityController.remove(req, res);

    expect(AbilityModel.remove).toHaveBeenCalledWith('c1', 'a1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});
