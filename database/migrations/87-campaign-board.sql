-- ================================================================
-- Стіл і Ширма кампанії: одна впорядкована дошка записів.
--
-- zone = 'table'  — Стіл: бачать гравці, але лише записи з is_visible.
-- zone = 'screen' — Ширма: лише майстер (і адмін).
--
-- Записи каталогів (НІП, істота, заклинання, спорядження, вміння, фракція,
-- локація, мапа) зберігаються як ЗНІМОК (title/subtitle/image/content),
-- прочитаний у момент додавання: гравець отримує картку з campaigns, а не
-- з чужого сервісу, тож приватний НІП майстра теж можна показати, і
-- читання столу не потребує join-ів у дев'ять схем з різними правилами
-- видимості. ref_id лишається для «Оновити з джерела» і посилання майстра.
--
-- campaign_maps лишається джерелом зв'язку кампанія↔мапа для maps-сервісу
-- (контекст пінів), тож запис kind='map' додається/видаляється разом із
-- рядком campaign_maps. campaign_gallery і campaigns.shared_notes
-- переносяться сюди і більше не використовуються.
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS campaigns.campaign_board_items (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id  UUID         NOT NULL REFERENCES campaigns.campaigns(id) ON DELETE CASCADE,
    zone         VARCHAR(10)  NOT NULL CHECK (zone IN ('table', 'screen')),
    kind         VARCHAR(20)  NOT NULL CHECK (kind IN (
                   'npc', 'creature', 'spell', 'equipment', 'ability', 'faction',
                   'location', 'map', 'image', 'note', 'custom')),
    ref_id       UUID,                    -- запис у чужій схемі, cross-schema, no FK
    ref_subtype  VARCHAR(20),             -- equipment: item | weapon | armor | artifact
    title        VARCHAR(200) NOT NULL,
    subtitle     VARCHAR(200),
    image_url    VARCHAR(500),
    image_crop   JSONB,
    content      TEXT,                    -- rich HTML
    is_visible   BOOLEAN      NOT NULL DEFAULT false,
    is_featured  BOOLEAN      NOT NULL DEFAULT false,
    position     INTEGER      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_board_items_order
    ON campaigns.campaign_board_items (campaign_id, zone, position);

-- Один «основний» запис на кампанію.
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_board_items_featured
    ON campaigns.campaign_board_items (campaign_id) WHERE is_featured;

-- ---------- Перенесення наявних даних (усе видиме, як і було) ----------

-- Спільні нотатки — першими на столі.
INSERT INTO campaigns.campaign_board_items (campaign_id, zone, kind, title, content, is_visible, position)
SELECT id, 'table', 'note', 'Спільні нотатки', shared_notes, true, 0
FROM campaigns.campaigns
WHERE shared_notes IS NOT NULL AND btrim(shared_notes) <> '' AND shared_notes <> '<p></p>';

-- Мапи (новіші вище, як було на Головній).
INSERT INTO campaigns.campaign_board_items
    (campaign_id, zone, kind, ref_id, title, image_url, is_visible, position, created_at)
SELECT cm.campaign_id, 'table', 'map', cm.map_id, m.name,
       COALESCE(m.preview_thumbnail_url, m.preview_image_url), true,
       100 + ROW_NUMBER() OVER (PARTITION BY cm.campaign_id ORDER BY cm.created_at DESC),
       cm.created_at
FROM campaigns.campaign_maps cm
JOIN maps.maps m ON m.id = cm.map_id;

-- Галерея (новіші вище).
INSERT INTO campaigns.campaign_board_items
    (campaign_id, zone, kind, title, image_url, is_visible, position, created_at)
SELECT g.campaign_id, 'table', 'image', 'Зображення', g.image_url, true,
       1000 + ROW_NUMBER() OVER (PARTITION BY g.campaign_id ORDER BY g.created_at DESC),
       g.created_at
FROM campaigns.campaign_gallery g;

-- Ущільнити позиції до 0..n-1 у межах кампанії.
UPDATE campaigns.campaign_board_items b
SET position = r.rn - 1
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY campaign_id, zone ORDER BY position, created_at) AS rn
    FROM campaigns.campaign_board_items
) r
WHERE r.id = b.id;

COMMIT;
