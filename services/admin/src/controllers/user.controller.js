const UserModel = require('../models/user.model');

const ROLES = ['user', 'game_master', 'admin'];

const UserController = {
  async list(req, res) {
    const users = await UserModel.findAll();
    res.json({ users });
  },

  // Нова роль потрапляє в access-токен користувача при наступному refresh
  // (auth перечитує користувача з БД), тобто протягом ~15 хв без перелогіну.
  async updateRole(req, res) {
    const { role } = req.body;
    if (!ROLES.includes(role)) return res.status(400).json({ message: `role має бути одним з: ${ROLES.join(', ')}` });
    // Адмін не може зняти права сам із себе — інакше легко лишитися без
    // жодного адміна й без доступу до цієї панелі.
    if (req.params.id === req.user.sub && role !== 'admin') {
      return res.status(400).json({ message: 'Не можна змінити власну роль' });
    }
    const user = await UserModel.updateRole(req.params.id, role);
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });
    res.json({ user });
  },
};

module.exports = UserController;
