jest.mock('../../models/profile.model');
jest.mock('../../models/publicProfile.model');

const ProfileModel = require('../../models/profile.model');
const PublicProfileModel = require('../../models/publicProfile.model');
const ProfileController = require('../profile.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ user = { sub: 'user-1' }, params = {} } = {}) {
  return { user, params };
}

beforeEach(() => jest.clearAllMocks());

describe('ProfileController.getMyProfile', () => {
  it('upserts the profile for the authenticated user and returns it', async () => {
    const profile = { user_id: 'user-1', bio: 'hello' };
    ProfileModel.upsert.mockResolvedValue(profile);

    const req = mockReq({ user: { sub: 'user-1' } });
    const res = mockRes();
    await ProfileController.getMyProfile(req, res);

    expect(ProfileModel.upsert).toHaveBeenCalledWith('user-1');
    expect(res.json).toHaveBeenCalledWith({ profile });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rethrows unexpected model errors instead of swallowing them', async () => {
    const err = new Error('db down');
    ProfileModel.upsert.mockRejectedValue(err);

    const req = mockReq();
    const res = mockRes();
    await expect(ProfileController.getMyProfile(req, res)).rejects.toBe(err);
  });
});

describe('ProfileController.getPublicByUsername', () => {
  it('returns 404 when no user is found for the username', async () => {
    PublicProfileModel.findUserByUsername.mockResolvedValue(null);

    const req = mockReq({ params: { username: 'ghost' } });
    const res = mockRes();
    await ProfileController.getPublicByUsername(req, res);

    expect(PublicProfileModel.findUserByUsername).toHaveBeenCalledWith('ghost');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Користувача не знайдено' });
    expect(PublicProfileModel.getPublicActivity).not.toHaveBeenCalled();
  });

  it('returns the aggregated public activity for a found user', async () => {
    PublicProfileModel.findUserByUsername.mockResolvedValue({ id: 'user-2', username: 'hero' });
    const activity = {
      characters: [{ id: 'c1' }],
      equipment: [],
      spells: [],
      abilities: [],
      maneuvers: [],
      collections: [],
    };
    PublicProfileModel.getPublicActivity.mockResolvedValue(activity);

    const req = mockReq({ params: { username: 'hero' } });
    const res = mockRes();
    await ProfileController.getPublicByUsername(req, res);

    expect(PublicProfileModel.getPublicActivity).toHaveBeenCalledWith('user-2');
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ username: 'hero', ...activity });
  });

  it('rethrows unexpected errors from findUserByUsername', async () => {
    const err = new Error('db down');
    PublicProfileModel.findUserByUsername.mockRejectedValue(err);

    const req = mockReq({ params: { username: 'hero' } });
    const res = mockRes();
    await expect(ProfileController.getPublicByUsername(req, res)).rejects.toBe(err);
  });

  it('rethrows unexpected errors from getPublicActivity', async () => {
    PublicProfileModel.findUserByUsername.mockResolvedValue({ id: 'user-2', username: 'hero' });
    const err = new Error('cross-schema query failed');
    PublicProfileModel.getPublicActivity.mockRejectedValue(err);

    const req = mockReq({ params: { username: 'hero' } });
    const res = mockRes();
    await expect(ProfileController.getPublicByUsername(req, res)).rejects.toBe(err);
  });
});
