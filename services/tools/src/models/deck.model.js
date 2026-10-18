const createDocumentModel = require('./document.model');

const SUMMARY = `
  jsonb_array_length(t.data->'cards') AS cards_count,
  jsonb_array_length(t.data->'suits') AS suits_count`;

module.exports = createDocumentModel({
  table: 'tools.decks',
  extraColumns: ['back_image_url'],
  listSelect: SUMMARY,
});
