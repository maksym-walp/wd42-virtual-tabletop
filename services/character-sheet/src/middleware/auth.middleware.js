const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(authHeader.slice(7), process.env.JWT_ACCESS_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireGameMaster(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'game_master') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  });
}

module.exports = { requireAuth, requireGameMaster };
