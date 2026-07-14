const ProfileModel = require('../models/profile.model');

const ProfileController = {
  async getMyProfile(req, res) {
    const profile = await ProfileModel.upsert(req.user.sub);
    res.json({ profile });
  },
};

module.exports = ProfileController;
