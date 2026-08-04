// Ланцюжок ПІСЛЯ requireAuth, який заповнює req.user з перевіреного
// access-токена (роль лежить у claim'і token'а). Увесь цей сервіс — лише для
// адмінів, тож мідлвар підключається один раз на весь роутер config.routes.js.
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Доступ лише для адміністраторів' });
  }
  next();
}

module.exports = requireAdmin;
