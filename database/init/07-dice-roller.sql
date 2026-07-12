-- ================================================================
-- Dice Roller schema
-- ================================================================
CREATE SCHEMA IF NOT EXISTS dice_roller;

-- Append-only log of every roll a user makes (button-driven or free-form
-- formula). `groups` holds the per-die breakdown produced by the formula
-- evaluator, e.g.:
--   [{"type":"dice","sides":20,"rolls":[14,7],"sign":1,"subtotal":21},
--    {"type":"adv","sides":10,"dice":[{"rolls":[3,9],"kept":9}],"sign":1,"subtotal":9},
--    {"type":"modifier","value":5,"sign":-1,"subtotal":-5}]
CREATE TABLE IF NOT EXISTS dice_roller.rolls (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL,
    formula    TEXT        NOT NULL,
    total      INTEGER     NOT NULL,
    groups     JSONB       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dice_roller_rolls_user_created
  ON dice_roller.rolls(user_id, created_at DESC);
