jest.mock('../../models/progress.model');

const ProgressModel = require('../../models/progress.model');
const ProgressController = require('../progress.controller');

// NOTE: as of this writing, src/routes/skill-tree.routes.js does not mount
// ProgressController at all — myProgress/unlock/lock/allProgress have no
// wired route, so none of them are reachable over HTTP yet (nor is any
// requireAuth/requireGameMaster middleware applied to allProgress). These
// tests exercise the controller functions directly. Documenting this as
// observed behavior, not something being fixed here.

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

beforeEach(() => jest.clearAllMocks());

describe('ProgressController.myProgress', () => {
  it('returns the progress for the authenticated user', async () => {
    const progress = [{ node_id: 'n1', unlocked_at: '2024-01-01' }];
    ProgressModel.findByUser.mockResolvedValue(progress);
    const req = { user: { sub: 'u1' } };
    const res = mockRes();
    await ProgressController.myProgress(req, res);
    expect(ProgressModel.findByUser).toHaveBeenCalledWith('u1');
    expect(res.json).toHaveBeenCalledWith({ progress });
  });

  it('rethrows unrelated errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    ProgressModel.findByUser.mockRejectedValue(err);
    const req = { user: { sub: 'u1' } };
    const res = mockRes();
    await expect(ProgressController.myProgress(req, res)).rejects.toBe(err);
  });
});

describe('ProgressController.unlock', () => {
  it('returns 200 idempotent message when the model returns null (already unlocked)', async () => {
    ProgressModel.unlock.mockResolvedValue(null);
    const req = { user: { sub: 'u1' }, params: { nodeId: 'n1' } };
    const res = mockRes();
    await ProgressController.unlock(req, res);
    expect(ProgressModel.unlock).toHaveBeenCalledWith('u1', 'n1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Вузол вже відкрито' });
  });

  it('returns 201 with the new progress row on a real unlock', async () => {
    const row = { id: 'p1', user_id: 'u1', node_id: 'n1' };
    ProgressModel.unlock.mockResolvedValue(row);
    const req = { user: { sub: 'u1' }, params: { nodeId: 'n1' } };
    const res = mockRes();
    await ProgressController.unlock(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ progress: row });
  });

  it('rethrows unrelated errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    ProgressModel.unlock.mockRejectedValue(err);
    const req = { user: { sub: 'u1' }, params: { nodeId: 'n1' } };
    const res = mockRes();
    await expect(ProgressController.unlock(req, res)).rejects.toBe(err);
  });
});

describe('ProgressController.lock', () => {
  it('returns 404 when nothing was locked/deleted', async () => {
    ProgressModel.lock.mockResolvedValue(false);
    const req = { user: { sub: 'u1' }, params: { nodeId: 'n1' } };
    const res = mockRes();
    await ProgressController.lock(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Вузол не був відкритий' });
  });

  it('returns a success message when locking succeeds', async () => {
    ProgressModel.lock.mockResolvedValue(true);
    const req = { user: { sub: 'u1' }, params: { nodeId: 'n1' } };
    const res = mockRes();
    await ProgressController.lock(req, res);
    expect(ProgressModel.lock).toHaveBeenCalledWith('u1', 'n1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Скасовано' });
  });

  it('rethrows unrelated errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    ProgressModel.lock.mockRejectedValue(err);
    const req = { user: { sub: 'u1' }, params: { nodeId: 'n1' } };
    const res = mockRes();
    await expect(ProgressController.lock(req, res)).rejects.toBe(err);
  });
});

describe('ProgressController.allProgress', () => {
  it('returns progress for all users', async () => {
    const progress = [
      { user_id: 'u1', node_id: 'n1', unlocked_at: '2024-01-01' },
      { user_id: 'u2', node_id: 'n2', unlocked_at: '2024-01-02' },
    ];
    ProgressModel.findAllUsers.mockResolvedValue(progress);
    const req = {};
    const res = mockRes();
    await ProgressController.allProgress(req, res);
    expect(ProgressModel.findAllUsers).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ progress });
  });

  it('rethrows unrelated errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    ProgressModel.findAllUsers.mockRejectedValue(err);
    const req = {};
    const res = mockRes();
    await expect(ProgressController.allProgress(req, res)).rejects.toBe(err);
  });
});
