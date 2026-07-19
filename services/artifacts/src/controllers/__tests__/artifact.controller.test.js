jest.mock('../../models/artifact.model');

const ArtifactModel = require('../../models/artifact.model');
const ArtifactController = require('../artifact.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ params = {}, query = {}, body = {}, user = { sub: 'user-1' } } = {}) {
  return { params, query, body, user };
}

beforeEach(() => jest.clearAllMocks());

describe('ArtifactController.list', () => {
  it('forwards query filters to the model and returns 200 with the list', async () => {
    ArtifactModel.findAll.mockResolvedValue([{ id: 'a1' }]);
    const req = mockReq({ query: { rarity: 'rare', creator: 'gm', search: 'sword', sort: 'price', dir: 'desc', scope: 'canonical' } });
    const res = mockRes();

    await ArtifactController.list(req, res);

    expect(ArtifactModel.findAll).toHaveBeenCalledWith('user-1', {
      rarity: 'rare', creator: 'gm', search: 'sword', sort: 'price', dir: 'desc', scope: 'canonical',
    });
    expect(res.json).toHaveBeenCalledWith({ artifacts: [{ id: 'a1' }] });
  });

  it('rethrows unrelated model errors', async () => {
    const err = new Error('db down');
    ArtifactModel.findAll.mockRejectedValue(err);
    const req = mockReq();
    const res = mockRes();
    await expect(ArtifactController.list(req, res)).rejects.toBe(err);
  });
});

describe('ArtifactController.getOne', () => {
  it('returns 404 when the artifact is not found', async () => {
    ArtifactModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await ArtifactController.getOne(req, res);

    expect(ArtifactModel.findById).toHaveBeenCalledWith('missing', 'user-1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Артефакт не знайдено' });
  });

  it('returns 200 with the artifact on success', async () => {
    ArtifactModel.findById.mockResolvedValue({ id: 'a1', name: 'Sword' });
    const req = mockReq({ params: { id: 'a1' } });
    const res = mockRes();

    await ArtifactController.getOne(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ artifact: { id: 'a1', name: 'Sword' } });
  });

  it('rethrows unrelated model errors', async () => {
    const err = new Error('db down');
    ArtifactModel.findById.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'a1' } });
    const res = mockRes();
    await expect(ArtifactController.getOne(req, res)).rejects.toBe(err);
  });
});

describe('ArtifactController.create', () => {
  it('returns 400 when name is missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await ArtifactController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'name є обовʼязковим' });
    expect(ArtifactModel.create).not.toHaveBeenCalled();
  });

  it('creates and returns 201 with the artifact on success', async () => {
    ArtifactModel.create.mockResolvedValue({ id: 'a1', name: 'Sword' });
    const req = mockReq({ body: { name: 'Sword' } });
    const res = mockRes();

    await ArtifactController.create(req, res);

    expect(ArtifactModel.create).toHaveBeenCalledWith('user-1', { name: 'Sword' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ artifact: { id: 'a1', name: 'Sword' } });
  });

  it('rethrows unrelated model errors', async () => {
    const err = new Error('db down');
    ArtifactModel.create.mockRejectedValue(err);
    const req = mockReq({ body: { name: 'Sword' } });
    const res = mockRes();
    await expect(ArtifactController.create(req, res)).rejects.toBe(err);
  });
});

describe('ArtifactController.update', () => {
  it('returns 404 when the artifact is not found or not owned', async () => {
    ArtifactModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'a1' }, body: { name: 'New' } });
    const res = mockRes();

    await ArtifactController.update(req, res);

    expect(ArtifactModel.update).toHaveBeenCalledWith('a1', 'user-1', { name: 'New' });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Артефакт не знайдено або недостатньо прав' });
  });

  it('returns 200 with the updated artifact on success', async () => {
    ArtifactModel.update.mockResolvedValue({ id: 'a1', name: 'New' });
    const req = mockReq({ params: { id: 'a1' }, body: { name: 'New' } });
    const res = mockRes();

    await ArtifactController.update(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ artifact: { id: 'a1', name: 'New' } });
  });

  it('rethrows unrelated model errors', async () => {
    const err = new Error('db down');
    ArtifactModel.update.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'a1' }, body: { name: 'New' } });
    const res = mockRes();
    await expect(ArtifactController.update(req, res)).rejects.toBe(err);
  });
});

describe('ArtifactController.remove', () => {
  it('returns 404 when the artifact is not found or not owned', async () => {
    ArtifactModel.delete.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'a1' } });
    const res = mockRes();

    await ArtifactController.remove(req, res);

    expect(ArtifactModel.delete).toHaveBeenCalledWith('a1', 'user-1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Артефакт не знайдено або недостатньо прав' });
  });

  it('returns 200 with a confirmation message on success', async () => {
    ArtifactModel.delete.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'a1' } });
    const res = mockRes();

    await ArtifactController.remove(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });

  it('rethrows unrelated model errors', async () => {
    const err = new Error('db down');
    ArtifactModel.delete.mockRejectedValue(err);
    const req = mockReq({ params: { id: 'a1' } });
    const res = mockRes();
    await expect(ArtifactController.remove(req, res)).rejects.toBe(err);
  });
});
