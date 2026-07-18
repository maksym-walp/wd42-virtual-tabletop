const pool = require('./db');

// Promote the users named in ADMIN_USERNAMES (comma-separated) to the `admin`
// role. Idempotent — only touches rows whose role differs — so it is safe to
// run on every boot/deploy. This is the sole mechanism for designating admins;
// there is no self-service path to the role. Admin-authored catalog entries are
// what the catalogs surface as "canonical".
async function seedAdmins() {
  const usernames = (process.env.ADMIN_USERNAMES || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  if (usernames.length === 0) return;

  try {
    const { rows } = await pool.query(
      `UPDATE auth.users
         SET role = 'admin', updated_at = NOW()
       WHERE username = ANY($1) AND role <> 'admin'
       RETURNING username`,
      [usernames]
    );
    if (rows.length) {
      console.log(`[auth] promoted to admin: ${rows.map((r) => r.username).join(', ')}`);
    }
  } catch (err) {
    // A seeding failure must not stop the service from starting.
    console.error('[auth] admin seeding failed:', err.message);
  }
}

module.exports = seedAdmins;
