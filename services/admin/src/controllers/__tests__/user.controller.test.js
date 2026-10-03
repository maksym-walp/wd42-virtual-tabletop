jest.mock('../../models/user.model');

const UserModel = require('../../models/user.model');
const UserController = require('../user.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}
function mockReq({ body = {}, params = {}, user = { sub: 'admin-1', role: 'admin' } } = {}) {
  return { body, params, user };
}

beforeEach(() => jest.clearAllMocks());

describe('UserController.updateRole', () => {
  it('400 on an unknown role', async () => {
    const res = mockRes();
    await UserController.updateRole(mockReq({ params: { id: 'u1' }, body: { role: 'superuser' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(UserModel.updateRole).not.toHaveBeenCalled();
  });

  it('400 when an admin tries to demote themselves', async () => {
    const res = mockRes();
    await UserController.updateRole(mockReq({ params: { id: 'admin-1' }, body: { role: 'user' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(UserModel.updateRole).not.toHaveBeenCalled();
  });

  it('404 when the user does not exist', async () => {
    UserModel.updateRole.mockResolvedValue(null);
    const res = mockRes();
    await UserController.updateRole(mockReq({ params: { id: 'u1' }, body: { role: 'game_master' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updates the role and returns the user', async () => {
    const user = { id: 'u1', username: 'bob', role: 'game_master' };
    UserModel.updateRole.mockResolvedValue(user);
    const res = mockRes();
    await UserController.updateRole(mockReq({ params: { id: 'u1' }, body: { role: 'game_master' } }), res);
    expect(UserModel.updateRole).toHaveBeenCalledWith('u1', 'game_master');
    expect(res.json).toHaveBeenCalledWith({ user });
  });
});
