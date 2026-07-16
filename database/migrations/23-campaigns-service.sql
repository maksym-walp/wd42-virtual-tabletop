-- ================================================================
-- New "campaigns" service — GM-run campaigns with flexible character
-- attachment (players join via invite code, or GM attaches directly).
-- Mirrors the character_sheet reference-table pattern for cross-schema
-- character_id references (no FK, plain UUID column).
-- ================================================================

CREATE SCHEMA IF NOT EXISTS campaigns;

CREATE TABLE IF NOT EXISTS campaigns.campaigns (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    gm_id        UUID         NOT NULL,
    name         VARCHAR(200) NOT NULL,
    invite_code  VARCHAR(12)  NOT NULL UNIQUE,
    shared_notes TEXT,
    gm_notes     TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_gm_id ON campaigns.campaigns(gm_id);

CREATE TABLE IF NOT EXISTS campaigns.campaign_characters (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id  UUID        NOT NULL REFERENCES campaigns.campaigns(id) ON DELETE CASCADE,
    character_id UUID        NOT NULL,
    added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (campaign_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_characters_character_id ON campaigns.campaign_characters(character_id);
CREATE INDEX IF NOT EXISTS idx_campaign_characters_campaign_id  ON campaigns.campaign_characters(campaign_id);
