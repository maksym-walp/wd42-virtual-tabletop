-- ================================================================
-- Migration: campaign Home-tab revamp
--   - description: free-text campaign blurb, shown on the Home tab
--     next to the GM's nickname.
--   - campaign_sessions: GM-authored past-session recaps, shown in
--     the Home tab's notes carousel alongside shared/GM notes.
-- ================================================================

ALTER TABLE campaigns.campaigns
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS campaigns.campaign_sessions (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id  UUID         NOT NULL REFERENCES campaigns.campaigns(id) ON DELETE CASCADE,
    title        VARCHAR(200) NOT NULL,
    content      TEXT,
    session_date DATE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_sessions_campaign_id ON campaigns.campaign_sessions(campaign_id);
