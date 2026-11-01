-- ================================================================
-- Дальнобійні й ближні заклинання — один вид «combat»: обидва в бою
-- йдуть через той самий потік касту (вибір цілі, кидок влучання,
-- шкода), тож окремого поділу дальнобійне/ближнє механіка не потребує.
-- ================================================================

UPDATE spellbook.spells SET spell_kind = 'combat' WHERE spell_kind IN ('ranged', 'melee');

UPDATE spellbook.spells
SET forms = (
  SELECT COALESCE(jsonb_agg(
    CASE WHEN f->>'spell_kind' IN ('ranged', 'melee')
         THEN f || jsonb_build_object('spell_kind', 'combat')
         ELSE f END
  ), '[]'::jsonb)
  FROM jsonb_array_elements(forms) f
)
WHERE forms <> '[]'::jsonb;

-- 'ranged' перейменовується на 'combat' (зберігає позицію в списку);
-- 'melee' просто прибирається — два ключі, один вид.
UPDATE admin.site_configs
SET value = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'key' = 'ranged' THEN jsonb_build_object('key', 'combat', 'label', 'Бойове')
         ELSE elem END
  )
  FROM jsonb_array_elements(value) elem
  WHERE elem->>'key' <> 'melee'
)
WHERE key = 'spell_kinds';
