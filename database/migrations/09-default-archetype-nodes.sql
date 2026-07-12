-- ================================================================
-- Migration: default starter node per archetype, auto-unlocked at
-- character creation (see CharacterModel.create's root-node INSERT,
-- which matches on is_root=true + the `archetypes` array column).
-- ================================================================

INSERT INTO skill_tree.nodes
  (title, description, cost, narrative_condition, archetype, archetypes, races, is_root, pos_x, pos_y)
SELECT
  'Початок шляху',
  'Ви звикли покладатися на власні м''язи, рефлекси та інстинкти, коли слова втрачають сенс. Цей вузол символізує вашу базову готовність до фізичного зіткнення, вміння тримати удар та домінувати на полі бою.',
  0,
  'Хтось відверто зневажив вас, загрожує вашим союзникам, або мирні аргументи остаточно вичерпали себе. Змусьте супротивника пошкодувати про це, вирішивши питання силою чи безапеляційною демонстрацією власної переваги.',
  'fighter', ARRAY['fighter'], '{}', true, 0, 0
WHERE NOT EXISTS (
  SELECT 1 FROM skill_tree.nodes WHERE title = 'Початок шляху' AND archetype = 'fighter'
);

INSERT INTO skill_tree.nodes
  (title, description, cost, narrative_condition, archetype, archetypes, races, is_root, pos_x, pos_y)
SELECT
  'Нова сторінка',
  'Ви відчули потоки енергії, що пронизують Мундіс, і навчилися направляти їх власною волею. Це ваше перше усвідомлене торкання до магічних сил, яке дозволяє формувати реальність та бачити те, що приховано від звичайних очей.',
  0,
  'Пізнання світу розпочинається із пізнання себе. Зіткніться з незрозумілим або опиніться в безвиході, де звичайна зброя безсила, та свідомо застосуйте магію уперше, щоб змінити хід подій.',
  'spellcaster', ARRAY['spellcaster'], '{}', true, 0, 0
WHERE NOT EXISTS (
  SELECT 1 FROM skill_tree.nodes WHERE title = 'Нова сторінка' AND archetype = 'spellcaster'
);

INSERT INTO skill_tree.nodes
  (title, description, cost, narrative_condition, archetype, archetypes, races, is_root, pos_x, pos_y)
SELECT
  'Перші кроки',
  'Там, де інші бачать перешкоди, ви бачите можливості. Ваша головна зброя — це гнучкість розуму, хитрощі та вміння блискавично адаптуватися до будь-яких неприємностей, залишаючись на крок попереду.',
  0,
  'Хочеш жити — умій крутитись. Опиніться у вкрай невигідній або небезпечній ситуації та виплутайтеся з неї, покладаючись виключно на власну вдачу, обман, соціальні маніпуляції або спритність рук.',
  'rogue', ARRAY['rogue'], '{}', true, 0, 0
WHERE NOT EXISTS (
  SELECT 1 FROM skill_tree.nodes WHERE title = 'Перші кроки' AND archetype = 'rogue'
);
