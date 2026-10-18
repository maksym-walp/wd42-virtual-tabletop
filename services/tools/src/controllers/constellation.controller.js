const model = require('../models/constellation.model');
const createDocumentController = require('./document.controller');
const { sanitizeConstellationData } = require('../lib/constellation-data');

module.exports = createDocumentController({
  model,
  type: 'constellation',
  label: { notFound: 'Сузір\'я не знайдено', deleted: 'Сузір\'я видалено', what: 'сузір\'я' },
  prepare: (body) => ({ data: sanitizeConstellationData(body.data) }),
});
