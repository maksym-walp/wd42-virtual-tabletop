jest.mock('../../models/maneuver.model');
jest.mock('../../models/prerequisite.model');
jest.mock('../authorize-character-write');

const ManeuverModel = require('../../models/maneuver.model');
const { checkPrerequisites, isVisibleToUser } = require('../../models/prerequisite.model');
const authorizeCharacterWrite = require('../authorize-character-write');
const ManeuverController = require('../maneuver.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq(overrides = {}) {
  return { params: {}, body: {}, user: { sub: 'user-1' }, ...overrides };
}

beforeEach(() => jest.clearAllMocks());

describe('ManeuverController.list', () => {
  it('lists maneuvers for the character without an auth check', async () => {
    ManeuverModel.findAll.mockResolvedValue([{ id: 'm1' }]);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await ManeuverController.list(req, res);

    expect(ManeuverModel.findAll).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ maneuvers: [{ id: 'm1' }] });
  });
});

describe('ManeuverController.add', () => {
  it('stops without further calls when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { maneuver_id: 'm1' } });
    const res = mockRes();

    await ManeuverController.add(req, res);

    expect(isVisibleToUser).not.toHaveBeenCalled();
    expect(ManeuverModel.add).not.toHaveBeenCalled();
  });

  it('400s when maneuver_id is missing', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: {} });
    const res = mockRes();

    await ManeuverController.add(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(isVisibleToUser).not.toHaveBeenCalled();
  });

  it('404s when the maneuver is not visible to the user', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    isVisibleToUser.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' }, body: { maneuver_id: 'm1' }, user: { sub: 'u1' } });
    const res = mockRes();

    await ManeuverController.add(req, res);

    expect(isVisibleToUser).toHaveBeenCalledWith('maneuvers.entries', 'm1', 'u1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(checkPrerequisites).not.toHaveBeenCalled();
  });

  it('403s with missing_node_ids when prerequisites are unmet', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    isVisibleToUser.mockResolvedValue(true);
    checkPrerequisites.mockResolvedValue({ met: false, missing: ['node-1'] });
    const req = mockReq({ params: { id: 'c1' }, body: { maneuver_id: 'm1' } });
    const res = mockRes();

    await ManeuverController.add(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Не виконано вимоги дерева розвитку', missing_node_ids: ['node-1'],
    });
    expect(ManeuverModel.add).not.toHaveBeenCalled();
  });

  it('201s and adds the maneuver when visible and prerequisites are met', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    isVisibleToUser.mockResolvedValue(true);
    checkPrerequisites.mockResolvedValue({ met: true, missing: [] });
    ManeuverModel.add.mockResolvedValue({ id: 'link-1', maneuver_id: 'm1' });
    const req = mockReq({ params: { id: 'c1' }, body: { maneuver_id: 'm1' } });
    const res = mockRes();

    await ManeuverController.add(req, res);

    expect(ManeuverModel.add).toHaveBeenCalledWith('c1', 'm1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ maneuver: { id: 'link-1', maneuver_id: 'm1' } });
  });
});

describe('ManeuverController.remove', () => {
  it('stops without touching the model when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', maneuverId: 'm1' } });
    const res = mockRes();

    await ManeuverController.remove(req, res);

    expect(ManeuverModel.remove).not.toHaveBeenCalled();
  });

  it('404s when nothing was removed', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    ManeuverModel.remove.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', maneuverId: 'm1' } });
    const res = mockRes();

    await ManeuverController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('confirms removal on success', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    ManeuverModel.remove.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', maneuverId: 'm1' } });
    const res = mockRes();

    await ManeuverController.remove(req, res);

    expect(ManeuverModel.remove).toHaveBeenCalledWith('c1', 'm1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});
