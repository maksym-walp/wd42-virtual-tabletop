-- ================================================================
-- Галерея зображень кампанії — картинки, які завантажує Майстер.
--
-- media-service записує сам файл і повертає site-relative URL; ця таблиця —
-- те, що робить той URL *власністю* кампанії. image_url завжди URL
-- (зазвичай /uploads/campaigns/<id>/gallery/<uuid>.jpg), ніколи не файловий
-- шлях — БД не знає, куди змонтовано volume.
--
-- Рядки каскадять разом із кампанією. Самі файли не видаляються:
-- media-service stateless і навмисно не має delete-ендпоінта.
-- ================================================================

CREATE SCHEMA IF NOT EXISTS campaigns;

CREATE TABLE IF NOT EXISTS campaigns.campaign_gallery (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID         NOT NULL REFERENCES campaigns.campaigns(id) ON DELETE CASCADE,
    image_url   VARCHAR(500) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_gallery_campaign_id ON campaigns.campaign_gallery(campaign_id);
