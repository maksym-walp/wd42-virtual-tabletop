// Gate a route to admin users only. Chain AFTER requireAuth, which populates
// req.user from the verified access token (the token carries `role`).
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}

module.exports = requireAdmin;
