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

const CANONICAL_ROLES = ['admin', 'game_master'];

// Can flag someone else's record as canonical without taking ownership of it.
function requireCanonicalManager(req, res, next) {
  requireAuth(req, res, () => {
    if (!CANONICAL_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: admin or game master only' });
    }
    next();
  });
}

// Strictly admin — unlike requireCanonicalManager, game_master is NOT enough here.
function requireAdminOwner(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }
    next();
  });
}

// is_canonical for a newly created record: only a GM/admin may set it, and for
// them it defaults to on (the create form shows a pre-ticked checkbox).
function canonicalOnCreate(req) {
  return CANONICAL_ROLES.includes(req.user?.role) && req.body?.is_canonical !== false;
}

module.exports = { requireAuth, requireCanonicalManager, requireAdminOwner, canonicalOnCreate };
