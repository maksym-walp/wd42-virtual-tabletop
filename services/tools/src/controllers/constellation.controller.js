const model = require('../models/constellation.model');
const createDocumentController = require('./document.controller');
const { sanitizeConstellationData } = require('../lib/constellation-data');
const { cleanText } = require('../lib/validation');

module.exports = createDocumentController({
  model,
  type: 'constellation',
  label: { notFound: 'Сузір\'я не знайдено', deleted: 'Сузір\'я видалено', what: 'сузір\'я' },
  prepare: (body) => ({
    data: sanitizeConstellationData(body.data),
    gm_notes: cleanText(body.gm_notes, 10000, 'Нотатки майстра') || null,
  }),
  // Нотатки майстра приватні: читає й експортує їх лише автор/адмін.
  privateFields: ['gm_notes'],
  // Для автора нотатки їдуть у файлі експорту, щоб не губилися при перенесенні;
  // для решти viewableBy уже прибрав поле, тож ключа у файлі немає взагалі.
  exportExtra: (item) => (item.gm_notes === undefined ? {} : { gm_notes: item.gm_notes }),
});
