function isAdmin(user) {
  return user.role === 'admin';
}

// Читати: власник, публічне або адмін. Писати: власник або адмін.
// Створювати може будь-який авторизований користувач.
function canRead(item, user) {
  return item.created_by === user.sub || item.is_public || isAdmin(user);
}

function canWrite(item, user) {
  return item.created_by === user.sub || isAdmin(user);
}

module.exports = { isAdmin, canRead, canWrite };
