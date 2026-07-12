jest.mock('../../models/edge.model');

const EdgeModel = require('../../models/edge.model');
const EdgeController = require('../edge.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

beforeEach(() => jest.clearAllMocks());

describe('EdgeController.create', () => {
  it('returns 400 when required fields are missing', async () => {
    const req = { body: {} };
    const res = mockRes();
    await EdgeController.create(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(EdgeModel.create).not.toHaveBeenCalled();
  });

  it('maps a unique-violation (23505) to 409', async () => {
    EdgeModel.create.mockRejectedValue({ code: '23505' });
    const req = { body: { source_id: 'a', target_id: 'b' } };
    const res = mockRes();
    await EdgeController.create(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('maps a foreign-key violation (23503) to 400', async () => {
    EdgeModel.create.mockRejectedValue({ code: '23503' });
    const req = { body: { source_id: 'a', target_id: 'b' } };
    const res = mockRes();
    await EdgeController.create(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rethrows unrelated errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    EdgeModel.create.mockRejectedValue(err);
    const req = { body: { source_id: 'a', target_id: 'b' } };
    const res = mockRes();
    await expect(EdgeController.create(req, res)).rejects.toBe(err);
  });

  it('returns 201 with the created edge on success', async () => {
    EdgeModel.create.mockResolvedValue({ id: 'e1' });
    const req = { body: { source_id: 'a', target_id: 'b' } };
    const res = mockRes();
    await EdgeController.create(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ edge: { id: 'e1' } });
  });
});
