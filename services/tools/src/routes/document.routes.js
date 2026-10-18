const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Однакові маршрути для кожного інструмента-документа. '/import' оголошений
// до '/:id', щоб "import" не читався як id.
function createDocumentRouter(controller) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', wrap(controller.list));
  router.post('/import', wrap(controller.import));
  router.post('/', wrap(controller.create));
  router.get('/:id/export', wrap(controller.export));
  router.get('/:id', wrap(controller.get));
  router.put('/:id', wrap(controller.update));
  router.delete('/:id', wrap(controller.remove));

  return router;
}

module.exports = createDocumentRouter;
