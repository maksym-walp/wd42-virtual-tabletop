const createDocumentRouter = require('./document.routes');
const controller = require('../controllers/constellation.controller');

module.exports = createDocumentRouter(controller);
