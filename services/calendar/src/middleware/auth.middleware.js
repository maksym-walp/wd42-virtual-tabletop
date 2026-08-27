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

// Calendar creation/editing (including months/weekdays/seasons/moons) is
// role-gated, not ownership-gated — any admin or game_master may manage any
// calendar, not just their own.
function requireCalendarManager(req, res, next) {
  requireAuth(req, res, () => {
    if (!['admin', 'game_master'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: admin or game master only' });
    }
    next();
  });
}

module.exports = { requireAuth, requireCalendarManager };
