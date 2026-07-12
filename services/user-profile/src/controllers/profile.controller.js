const ProfileModel = require('../models/profile.model');

const ProfileController = {
  async getMyProfile(req, res) {
    const profile = await ProfileModel.upsert(req.user.sub);
    res.json({ profile });
  },

  async updateMyProfile(req, res) {
    const { displayName, bio, avatarUrl } = req.body;
    await ProfileModel.upsert(req.user.sub);
    const profile = await ProfileModel.update(req.user.sub, { displayName, bio, avatarUrl });
    res.json({ profile });
  },
};

module.exports = ProfileController;
