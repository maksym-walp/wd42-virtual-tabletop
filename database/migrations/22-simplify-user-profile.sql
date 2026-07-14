-- Simplify user_profile.profiles: the profile page no longer exposes a bio,
-- display name, or avatar, so these columns are dead weight.
--
-- Safe for login: authentication (email, username, password_hash) lives
-- entirely in auth.users, a completely separate schema. Nothing in
-- user_profile.profiles is read by the login/register/refresh flow, so
-- dropping these columns cannot affect a user's ability to sign in.
-- DROP COLUMN in Postgres is a metadata-only change (no table rewrite, no
-- long lock), so this is safe to run against a live database.
--
-- Deployment order matters, not this migration's contents: deploy the
-- application code that stops reading/writing display_name/bio/avatar_url
-- (services/user-profile, services/frontend) BEFORE running this migration,
-- so no in-flight request can reference a column that no longer exists.
ALTER TABLE user_profile.profiles
    DROP COLUMN IF EXISTS display_name,
    DROP COLUMN IF EXISTS bio,
    DROP COLUMN IF EXISTS avatar_url;
