-- ================================================================
-- Компоненти вмінь + одиниці тривалості «раунд» і «дія».
--
-- 1. abilities.entries.components — той самий формат, що й у заклинань
--    (міграція 30): JSONB-масив { item_id, name, quantity, unit }.
--    Додаткові форми вміння тримають власні компоненти у forms[].
--
-- 2. duration_unit отримує 'round' (раунди) у вмінь і заклинань, а
--    заклинання — ще й 'action' (дії; у вмінь він з'явився в 72).
--    Імена CHECK-обмежень авто-згенеровані Postgres, тож шукаємо їх
--    динамічно за визначенням, а не за іменем.
-- ================================================================

ALTER TABLE abilities.entries
    ADD COLUMN IF NOT EXISTS components JSONB NOT NULL DEFAULT '[]';

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname, ns.nspname, cls.relname
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    WHERE con.contype = 'c'
      AND ((ns.nspname = 'abilities' AND cls.relname = 'entries')
        OR (ns.nspname = 'spellbook' AND cls.relname = 'spells'))
      AND pg_get_constraintdef(con.oid) LIKE '%duration_unit%'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.nspname, r.relname, r.conname);
  END LOOP;
END $$;

ALTER TABLE abilities.entries
    ADD CONSTRAINT entries_duration_unit_check
    CHECK (duration_unit IN ('instant', 'action', 'round', 'seconds', 'minutes', 'hours', 'days', 'permanent'));

ALTER TABLE spellbook.spells
    ADD CONSTRAINT spells_duration_unit_check
    CHECK (duration_unit IN ('instant', 'action', 'round', 'seconds', 'minutes', 'hours', 'days', 'permanent'));
