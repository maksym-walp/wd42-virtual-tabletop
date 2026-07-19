jest.mock('../../models/tree-progress.model');
jest.mock('../authorize-character-write');

const TreeProgressModel = require('../../models/tree-progress.model');
const authorizeCharacterWrite = require('../authorize-character-write');
const TreeProgressController = require('../tree-progress.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq(overrides = {}) {
  return { params: {}, body: {}, user: { sub: 'user-1' }, ...overrides };
}

beforeEach(() => jest.clearAllMocks());

describe('TreeProgressController.list', () => {
  it('lists progress for the character without an auth check', async () => {
    TreeProgressModel.findAll.mockResolvedValue([{ node_id: 'n1' }]);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await TreeProgressController.list(req, res);

    expect(TreeProgressModel.findAll).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ progress: [{ node_id: 'n1' }] });
  });
});

describe('TreeProgressController.unlock', () => {
  it('stops without touching the model when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', nodeId: 'n1' } });
    const res = mockRes();

    await TreeProgressController.unlock(req, res);

    expect(TreeProgressModel.unlock).not.toHaveBeenCalled();
  });

  it('is idempotent: returns 200 (not 201) when the node was already unlocked', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    TreeProgressModel.unlock.mockResolvedValue(null); // ON CONFLICT DO NOTHING -> already unlocked
    const req = mockReq({ params: { id: 'c1', nodeId: 'n1' } });
    const res = mockRes();

    await TreeProgressController.unlock(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Вузол вже відкрито' });
  });

  it('201s with the new progress row on success', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    TreeProgressModel.unlock.mockResolvedValue({ id: 'p1', node_id: 'n1' });
    const req = mockReq({ params: { id: 'c1', nodeId: 'n1' } });
    const res = mockRes();

    await TreeProgressController.unlock(req, res);

    expect(TreeProgressModel.unlock).toHaveBeenCalledWith('c1', 'n1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ progress: { id: 'p1', node_id: 'n1' } });
  });
});

describe('TreeProgressController.lock', () => {
  it('stops without touching the model when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', nodeId: 'n1' } });
    const res = mockRes();

    await TreeProgressController.lock(req, res);

    expect(TreeProgressModel.lock).not.toHaveBeenCalled();
  });

  it('404s when the node was not unlocked', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    TreeProgressModel.lock.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', nodeId: 'n1' } });
    const res = mockRes();

    await TreeProgressController.lock(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('confirms lock on success', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    TreeProgressModel.lock.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', nodeId: 'n1' } });
    const res = mockRes();

    await TreeProgressController.lock(req, res);

    expect(TreeProgressModel.lock).toHaveBeenCalledWith('c1', 'n1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Скасовано' });
  });
});
