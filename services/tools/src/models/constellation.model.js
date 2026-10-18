const createDocumentModel = require('./document.model');

// У списку замість усього `data` віддаємо лише геометрію для міні-прев'ю
// на картці (id, x, y, size зірок і лінії) та кількості.
const PREVIEW = `
  jsonb_array_length(t.data->'stars') AS stars_count,
  jsonb_array_length(t.data->'lines') AS lines_count,
  jsonb_build_object(
    'stars', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s->>'id', 'x', s->'x', 'y', s->'y', 'size', s->'size'))
                       FROM jsonb_array_elements(t.data->'stars') s), '[]'::jsonb),
    'lines', t.data->'lines'
  ) AS preview`;

module.exports = createDocumentModel({ table: 'tools.constellations', listSelect: PREVIEW });
