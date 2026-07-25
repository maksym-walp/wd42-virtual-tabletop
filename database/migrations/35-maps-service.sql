-- ================================================================
-- "maps" service — standalone interactive maps + lore, INDEPENDENT of
-- campaigns. A map is owned by its creator (created_by) and is either
-- private (owner + admin) or public (any authenticated user). Campaigns
-- may reference maps via lightweight "cards" (campaigns.campaign_maps),
-- but maps do not depend on campaigns.
-- Cross-schema owner refs (created_by -> auth.users.id) stay FK-less
-- plain UUID columns, matching the repo convention.
-- ================================================================

CREATE SCHEMA IF NOT EXISTS maps;

-- Logical map entity. Visibility: owner + admin always; everyone if is_public.
CREATE TABLE IF NOT EXISTS maps.maps (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID         NOT NULL,                 -- auth.users.id, cross-schema, no FK
    name       VARCHAR(200) NOT NULL,
    is_public  BOOLEAN      NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maps_created_by ON maps.maps(created_by);
CREATE INDEX IF NOT EXISTS idx_maps_is_public  ON maps.maps(is_public) WHERE is_public = true;

-- Image layers ("lenses") belonging to a map (Political, Geographical, ...)
CREATE TABLE IF NOT EXISTS maps.map_lenses (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id     UUID         NOT NULL REFERENCES maps.maps(id) ON DELETE CASCADE,
    name       VARCHAR(200) NOT NULL,
    image_url  VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_map_lenses_map_id ON maps.map_lenses(map_id);

-- Lore entity (locations), owned by its creator — reusable across the owner's
-- maps via pins. Readability is derived (owner/admin, or pinned on a readable
-- map); gm_note is stripped from non-owner responses in the service.
CREATE TABLE IF NOT EXISTS maps.locations (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by  UUID         NOT NULL,                 -- auth.users.id, cross-schema, no FK
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    gm_note     TEXT,
    image_url   VARCHAR(500),
    type        VARCHAR(20)  CHECK (type IS NULL OR type IN ('city', 'ruin', 'dungeon')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_created_by ON maps.locations(created_by);

-- Pin: places a location on a map at normalized (0..1) coordinates, visible
-- within an app-defined [min_zoom, max_zoom] range.
CREATE TABLE IF NOT EXISTS maps.map_pins (
    id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id       UUID             NOT NULL REFERENCES maps.maps(id) ON DELETE CASCADE,
    location_id  UUID             NOT NULL REFERENCES maps.locations(id) ON DELETE CASCADE,
    x_coordinate DOUBLE PRECISION NOT NULL CHECK (x_coordinate >= 0 AND x_coordinate <= 1),
    y_coordinate DOUBLE PRECISION NOT NULL CHECK (y_coordinate >= 0 AND y_coordinate <= 1),
    min_zoom     SMALLINT         NOT NULL DEFAULT 0   CHECK (min_zoom >= 0),
    max_zoom     SMALLINT         NOT NULL DEFAULT 100 CHECK (max_zoom >= 0),
    created_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    CHECK (min_zoom <= max_zoom)
);

CREATE INDEX IF NOT EXISTS idx_map_pins_map_id      ON maps.map_pins(map_id);
CREATE INDEX IF NOT EXISTS idx_map_pins_location_id ON maps.map_pins(location_id);

-- ----------------------------------------------------------------
-- Campaign → map "cards": a campaign references standalone maps. Lives in the
-- campaigns schema (owned by the campaigns service). map_id is a cross-service
-- reference to maps.maps(id): plain UUID, no FK (per the repo convention), so
-- deleting a map may leave a dangling card — the JOIN in the query drops it.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns.campaign_maps (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID        NOT NULL REFERENCES campaigns.campaigns(id) ON DELETE CASCADE,
    map_id      UUID        NOT NULL,                  -- maps.maps.id, cross-service, no FK
    added_by    UUID        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (campaign_id, map_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_maps_campaign_id ON campaigns.campaign_maps(campaign_id);
