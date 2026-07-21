jest.mock('../../models/maneuver.model');

const ManeuverModel = require('../../models/maneuver.model');
const ManeuverController = require('../maneuver.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ body = {}, params = {}, query = {}, user = { sub: 'user-1' } } = {}) {
  return { body, params, query, user };
}

beforeEach(() => jest.clearAllMocks());

describe('ManeuverController.list', () => {
  it('passes search/sort/scope query params through to the model and returns maneuvers', async () => {
    ManeuverModel.findAll.mockResolvedValue([{ id: 'm1' }]);
    const req = mockReq({ query: { search: 'парирування', sort: 'name', scope: 'user' } });
    const res = mockRes();

    await ManeuverController.list(req, res);

    expect(ManeuverModel.findAll).toHaveBeenCalledWith('user-1', {
      search: 'парирування',
      sort: 'name',
      scope: 'user',
    }, false);
    expect(res.json).toHaveBeenCalledWith({ maneuvers: [{ id: 'm1' }] });
  });
});

describe('ManeuverController.getOne', () => {
  it('returns 404 when the maneuver is not found or not visible', async () => {
    ManeuverModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await ManeuverController.getOne(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Маневр не знайдено' });
  });

  it('returns 200 with the maneuver on success', async () => {
    ManeuverModel.findById.mockResolvedValue({ id: 'm1', name: 'Випад' });
    const req = mockReq({ params: { id: 'm1' } });
    const res = mockRes();

    await ManeuverController.getOne(req, res);

    expect(ManeuverModel.findById).toHaveBeenCalledWith('m1', 'user-1', false);
    expect(res.json).toHaveBeenCalledWith({ maneuver: { id: 'm1', name: 'Випад' } });
  });
});

describe('ManeuverController.create', () => {
  it('returns 400 when name is missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await ManeuverController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'name є обовʼязковим' });
    expect(ManeuverModel.create).not.toHaveBeenCalled();
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    ManeuverModel.create.mockRejectedValue(err);
    const req = mockReq({ body: { name: 'Випад' } });
    const res = mockRes();

    await expect(ManeuverController.create(req, res)).rejects.toBe(err);
  });

  it('returns 201 with the created maneuver on success', async () => {
    ManeuverModel.create.mockResolvedValue({ id: 'm1', name: 'Випад' });
    const req = mockReq({ body: { name: 'Випад' } });
    const res = mockRes();

    await ManeuverController.create(req, res);

    expect(ManeuverModel.create).toHaveBeenCalledWith('user-1', { name: 'Випад' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ maneuver: { id: 'm1', name: 'Випад' } });
  });
});

describe('ManeuverController.update', () => {
  it('returns 404 when the maneuver is not found or not owned', async () => {
    ManeuverModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'm1' }, body: { name: 'Нова назва' } });
    const res = mockRes();

    await ManeuverController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Маневр не знайдено або недостатньо прав' });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    ManeuverModel.update.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'm1' }, body: { name: 'Нова назва' } });
    const res = mockRes();

    await expect(ManeuverController.update(req, res)).rejects.toBe(err);
  });

  it('returns 200 with the updated maneuver on success', async () => {
    ManeuverModel.update.mockResolvedValue({ id: 'm1', name: 'Нова назва' });
    const req = mockReq({ params: { id: 'm1' }, body: { name: 'Нова назва' } });
    const res = mockRes();

    await ManeuverController.update(req, res);

    expect(ManeuverModel.update).toHaveBeenCalledWith('m1', 'user-1', { name: 'Нова назва' }, false);
    expect(res.json).toHaveBeenCalledWith({ maneuver: { id: 'm1', name: 'Нова назва' } });
  });
});

describe('ManeuverController.remove', () => {
  it('returns 404 when the maneuver is not found or not owned', async () => {
    ManeuverModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'm1' } });
    const res = mockRes();

    await ManeuverController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Маневр не знайдено або недостатньо прав' });
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    ManeuverModel.delete.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'm1' } });
    const res = mockRes();

    await expect(ManeuverController.remove(req, res)).rejects.toBe(err);
  });

  it('returns 200 with a confirmation message on success', async () => {
    ManeuverModel.delete.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'm1' } });
    const res = mockRes();

    await ManeuverController.remove(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});
