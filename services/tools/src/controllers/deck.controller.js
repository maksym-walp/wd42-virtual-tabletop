const model = require('../models/deck.model');
const createDocumentController = require('./document.controller');
const { sanitizeDeckData } = require('../lib/deck-data');
const { cleanImageUrl } = require('../lib/validation');

module.exports = createDocumentController({
  model,
  type: 'deck',
  label: { notFound: 'Колоду не знайдено', deleted: 'Колоду видалено', what: 'колода' },
  prepare: (body) => ({
    back_image_url: cleanImageUrl(body.back_image_url, 'Зворот колоди'),
    data: sanitizeDeckData(body.data),
  }),
  // Посилання на зображення лишаємо у файлі: без картинок колода мало що варта,
  // а в межах однієї інсталяції вони лишаються робочими.
  exportExtra: (item) => ({ back_image_url: item.back_image_url }),
});
