-- ================================================================
-- equipment.weapons.modifier — яка навичка персонажа кидається разом зі
-- зброєю. 'universal' — зброя не привʼязана до конкретної навички (кидається
-- найкраща з двох), інакше — ключ однієї з 20 навичок персонажа
-- (constants/characterSheet.js CHARACTERISTICS), включно з типовими
-- sleight_of_hand/strength, які форма пропонує окремими кнопками.
-- ================================================================

ALTER TABLE equipment.weapons
  ADD COLUMN IF NOT EXISTS modifier VARCHAR(20)
    CHECK (modifier IS NULL OR modifier IN (
      'universal',
      'evasion', 'acrobatics', 'stealth', 'sleight_of_hand',
      'strength', 'immunity', 'magic_sense', 'endurance',
      'history', 'nature', 'erudition', 'mysticism',
      'intuition', 'spellcasting', 'cleverness', 'perception',
      'will', 'deception', 'artistry', 'persuasion'
    ));
