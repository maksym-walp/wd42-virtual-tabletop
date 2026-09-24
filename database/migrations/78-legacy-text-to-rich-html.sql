-- ================================================================
-- One-time content migration: every description/notes field that used to
-- hold the old lightweight markup (`[[formula]]` dice tags, `[text](url)`
-- links, plain newlines) now holds HTML, rendered by the new TipTap-based
-- SmartTextarea/SmartTextReader (see services/frontend/src/components/ui/
-- SmartTextarea.jsx and .../SmartTextReader.jsx). This rewrites existing
-- rows in place so old content keeps rendering identically (dice badge
-- still rolls, link still opens) under the new renderer.
--
-- Idempotent: only touches rows whose value doesn't already look like HTML
-- (doesn't start with '<'), so re-running this file is a no-op the second
-- time — matters because migrate.sh only guards against re-running a whole
-- *file*, not against a column having already been converted some other
-- way.
-- ================================================================

CREATE FUNCTION pg_temp.legacy_text_to_html(input TEXT) RETURNS TEXT AS $func$
DECLARE
  escaped TEXT;
  paragraphs TEXT[];
  para TEXT;
  html_paragraphs TEXT[] := '{}';
BEGIN
  IF input IS NULL OR input = '' THEN
    RETURN input;
  END IF;

  -- CRLF -> LF, then escape HTML-special chars before any tag gets built.
  escaped := replace(input, chr(13) || chr(10), chr(10));
  escaped := replace(escaped, '&', '&amp;');
  escaped := replace(escaped, '<', '&lt;');
  escaped := replace(escaped, '>', '&gt;');
  escaped := replace(escaped, '"', '&quot;');

  -- [[formula]] -> the dice-roll node's HTML shape (see DiceRollNode.jsx's
  -- parseHTML/renderHTML: span[data-type="dice-roll"][data-formula]).
  escaped := regexp_replace(escaped, '\[\[([^\]]+)\]\]', '<span data-type="dice-roll" data-formula="\1">\1</span>', 'g');

  -- [text](url) -> <a href>, only for the same allow-listed schemes the old
  -- reader accepted (https?:// or a root-relative /path) — anything else
  -- is left as literal escaped text, same fallback the old reader had.
  escaped := regexp_replace(escaped, '\[([^\]]*)\]\(((?:https?://|/)[^)]*)\)', '<a href="\2">\1</a>', 'g');

  -- Blank-line-separated paragraphs -> <p>; a single newline inside one -> <br>.
  paragraphs := regexp_split_to_array(escaped, '\n{2,}');
  FOREACH para IN ARRAY paragraphs LOOP
    IF trim(para) <> '' THEN
      html_paragraphs := array_append(html_paragraphs, regexp_replace(para, '\n', '<br>', 'g'));
    END IF;
  END LOOP;

  IF array_length(html_paragraphs, 1) IS NULL THEN
    RETURN '';
  END IF;

  RETURN '<p>' || array_to_string(html_paragraphs, '</p><p>') || '</p>';
END;
$func$ LANGUAGE plpgsql;

DO $migrate$
DECLARE
  targets CONSTANT TEXT[] := ARRAY[
    'spellbook.spells.mechanical_desc',
    'spellbook.spells.narrative_desc',
    'abilities.entries.mechanical_desc',
    'abilities.collections.description',
    'equipment.weapons.description',
    'equipment.armor.description',
    'equipment.artifacts.description',
    'maps.location_versions.description',
    'maps.location_versions.gm_note',
    'campaigns.campaigns.description',
    'campaigns.campaigns.shared_notes',
    'campaigns.campaigns.gm_notes',
    'campaigns.campaign_sessions.content',
    'chronology.calendars.description',
    'chronology.calendar_events.description',
    'skill_tree.nodes.description',
    'character_sheet.characters.backstory',
    'character_sheet.characters.notes',
    'compendium.races.description',
    'compendium.peoples.description',
    'compendium.factions.description',
    'compendium.species.description',
    'compendium.subspecies.description',
    'compendium.compendium_entries.description'
  ];
  target TEXT;
  parts TEXT[];
  v_schema TEXT;
  v_table TEXT;
  v_column TEXT;
BEGIN
  FOREACH target IN ARRAY targets LOOP
    parts := string_to_array(target, '.');
    v_schema := parts[1];
    v_table := parts[2];
    v_column := parts[3];

    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = v_schema AND c.table_name = v_table AND c.column_name = v_column
    ) THEN
      EXECUTE format(
        'UPDATE %I.%I SET %I = pg_temp.legacy_text_to_html(%I) WHERE %I IS NOT NULL AND %I <> %L AND %I NOT LIKE %L',
        v_schema, v_table, v_column, v_column, v_column, v_column, '', v_column, '<%'
      );
    END IF;
  END LOOP;
END $migrate$;
