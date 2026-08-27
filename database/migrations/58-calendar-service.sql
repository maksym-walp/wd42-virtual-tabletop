-- ================================================================
-- "calendar" service — custom fantasy calendars (months, weekdays,
-- seasons, moons). A calendar is owned by its creator (creator_id) and is
-- either private (owner + admin) or public (any authenticated user), same
-- convention as maps.maps (see 35-maps-service.sql). Writing to a calendar
-- (create/edit, including its months/weekdays/seasons/moons) is gated at
-- the service layer to admin/game_master roles, not by ownership — any
-- admin/game_master may manage any calendar.
-- Cross-schema owner ref (creator_id -> auth.users.id) stays a FK-less
-- plain UUID column, matching the repo convention.
-- ================================================================

CREATE SCHEMA IF NOT EXISTS calendar;

CREATE TABLE IF NOT EXISTS calendar.calendars (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id         UUID         NOT NULL,          -- auth.users.id, cross-schema, no FK
    name               VARCHAR(200) NOT NULL,
    description        TEXT,
    current_era_name   VARCHAR(200),
    previous_era_name  VARCHAR(200),                    -- used for negative (BCE-style) years
    first_day_offset   INT          NOT NULL DEFAULT 0, -- weekday offset of day 1 of year 1
    is_private         BOOLEAN      NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendars_creator_id ON calendar.calendars(creator_id);
CREATE INDEX IF NOT EXISTS idx_calendars_is_private  ON calendar.calendars(is_private) WHERE is_private = false;

CREATE TABLE IF NOT EXISTS calendar.calendar_months (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID         NOT NULL REFERENCES calendar.calendars(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    length      INT          NOT NULL CHECK (length > 0),
    order_num   INT          NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_months_calendar_id ON calendar.calendar_months(calendar_id);

CREATE TABLE IF NOT EXISTS calendar.calendar_weekdays (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID         NOT NULL REFERENCES calendar.calendars(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    order_num   INT          NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_weekdays_calendar_id ON calendar.calendar_weekdays(calendar_id);

-- start_month_id points at one of the calendar's own months; cascades with
-- it since a season cannot start in a month that no longer exists.
CREATE TABLE IF NOT EXISTS calendar.calendar_seasons (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id    UUID         NOT NULL REFERENCES calendar.calendars(id) ON DELETE CASCADE,
    name           VARCHAR(200) NOT NULL,
    start_month_id UUID         NOT NULL REFERENCES calendar.calendar_months(id) ON DELETE CASCADE,
    start_day      INT          NOT NULL CHECK (start_day > 0),
    color          VARCHAR(7)   NOT NULL,               -- hex, e.g. #4caf50
    bg_image_url   VARCHAR(500),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_seasons_calendar_id    ON calendar.calendar_seasons(calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendar_seasons_start_month_id ON calendar.calendar_seasons(start_month_id);

CREATE TABLE IF NOT EXISTS calendar.calendar_moons (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id  UUID         NOT NULL REFERENCES calendar.calendars(id) ON DELETE CASCADE,
    name         VARCHAR(200) NOT NULL,
    cycle_length REAL         NOT NULL CHECK (cycle_length > 0), -- days per full cycle
    shift        INT          NOT NULL DEFAULT 0,                -- day offset of cycle start
    color        VARCHAR(7)   NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_moons_calendar_id ON calendar.calendar_moons(calendar_id);
