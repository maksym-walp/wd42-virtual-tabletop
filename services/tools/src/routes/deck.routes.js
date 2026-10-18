const createDocumentRouter = require('./document.routes');
const controller = require('../controllers/deck.controller');

module.exports = createDocumentRouter(controller);
