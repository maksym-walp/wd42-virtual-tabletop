const ProfileModel = require('../models/profile.model');
const PublicProfileModel = require('../models/publicProfile.model');

const ProfileController = {
  async getMyProfile(req, res) {
    const profile = await ProfileModel.upsert(req.user.sub);
    res.json({ profile });
  },

  // Aggregated public profile for any user, addressed by username.
  async getPublicByUsername(req, res) {
    const user = await PublicProfileModel.findUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

    const activity = await PublicProfileModel.getPublicActivity(user.id);
    res.json({ username: user.username, ...activity });
  },
};

module.exports = ProfileController;
