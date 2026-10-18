-- ================================================================
-- Сервіс tools — спільний дім для допоміжних інструментів.
--
--   * tools.constellations — сузір'я: зірки (назва, опис, рівень 1–3, позиція)
--     і лінії між ними. Зірки й лінії лежать у `data` (JSONB) цілим
--     документом: { stars: [{ id, x, y, size, name, description }],
--     lines: [{ a, b }] } — зберігаються й віддаються разом, а експорт/імпорт
--     лишається тривіальним. Валідує сервіс (services/tools/src/lib).
--   * tools.decks — кастомні колоди карт: масті, номінали й карти
--     (suits/ranks/cards у `data`), зворот колоди — окрема колонка.
--
-- created_by — id користувача з auth.users без FK (між схемами), так само,
-- як у maps/chronology. is_public відкриває запис для читання всім.
-- ================================================================

CREATE SCHEMA IF NOT EXISTS tools;

CREATE TABLE IF NOT EXISTS tools.constellations (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by  UUID         NOT NULL,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    data        JSONB        NOT NULL DEFAULT '{"stars": [], "lines": []}'::jsonb,
    is_public   BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_constellations_created_by ON tools.constellations(created_by);
CREATE INDEX IF NOT EXISTS idx_constellations_is_public  ON tools.constellations(is_public) WHERE is_public = true;

CREATE TABLE IF NOT EXISTS tools.decks (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by      UUID         NOT NULL,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    back_image_url  VARCHAR(500),
    data            JSONB        NOT NULL DEFAULT '{"suits": [], "ranks": [], "cards": []}'::jsonb,
    is_public       BOOLEAN      NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decks_created_by ON tools.decks(created_by);
CREATE INDEX IF NOT EXISTS idx_decks_is_public  ON tools.decks(is_public) WHERE is_public = true;
