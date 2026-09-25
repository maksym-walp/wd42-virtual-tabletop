const UserModel = require('../models/user.model');

const UserController = {
  async list(req, res) {
    const users = await UserModel.findAll();
    res.json({ users });
  },
};

module.exports = UserController;
