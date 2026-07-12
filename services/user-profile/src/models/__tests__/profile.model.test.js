const ProfileModel = require('../profile.model');

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('ProfileModel.upsert', () => {
  it('returns the existing profile without creating one when found', async () => {
    jest.spyOn(ProfileModel, 'findByUserId').mockResolvedValue({ user_id: 'u1' });
    const createSpy = jest.spyOn(ProfileModel, 'create');

    const result = await ProfileModel.upsert('u1');

    expect(result).toEqual({ user_id: 'u1' });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('creates a profile when none exists yet', async () => {
    jest.spyOn(ProfileModel, 'findByUserId').mockResolvedValue(null);
    jest.spyOn(ProfileModel, 'create').mockResolvedValue({ user_id: 'u1', bio: null });

    const result = await ProfileModel.upsert('u1');

    expect(ProfileModel.create).toHaveBeenCalledWith('u1');
    expect(result).toEqual({ user_id: 'u1', bio: null });
  });
});
