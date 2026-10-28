-- ================================================================
-- Завершення бою: POST /api/campaigns/:id/combat/end ставить ended_at і
-- нараховує учасникам-персонажам по годині таймера діяльності за кожен
-- розпочатий раунд (ідемпотентно, source_key = combat:<sceneId>).
-- ================================================================

ALTER TABLE campaigns.combat_scenes
    ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
