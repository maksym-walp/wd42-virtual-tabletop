// Species/subspecies/entries: owner + public + role-based, mirroring the
// maps service's access pattern (created_by + is_public).

function isAdmin(user) {
  return user.role === 'admin';
}

// Only game masters and admins may create records.
function canCreate(user) {
  return user.role === 'game_master' || isAdmin(user);
}

// Write (update/delete): admin may touch anything; a game master only their
// own records — one GM cannot edit another GM's private homebrew content.
function canWrite(record, user) {
  return isAdmin(user) || (user.role === 'game_master' && record.created_by === user.sub);
}

module.exports = { isAdmin, canCreate, canWrite };
