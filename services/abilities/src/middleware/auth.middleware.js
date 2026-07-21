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

// Can flag someone else's record as canonical without taking ownership of it.
function requireCanonicalManager(req, res, next) {
  requireAuth(req, res, () => {
    if (!['admin', 'game_master'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: admin or game master only' });
    }
    next();
  });
}

module.exports = { requireAuth, requireCanonicalManager };
