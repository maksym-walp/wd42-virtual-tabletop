const express = require('express');
const { createCatalogController, UnionController } = require('../controllers/catalog.controller');
const { requireAuth, requireCanonicalManager } = require('../middleware/auth.middleware');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Повний CRUD одного виду спорядження: /items, /weapons, /armor, /artifacts.
function createCatalogRouter(kind) {
  const controller = createCatalogController(kind);
  const router = express.Router();

  router.get('/',        requireAuth, wrap(controller.list));
  router.post('/',       requireAuth, wrap(controller.create));
  router.get('/:id',     requireAuth, wrap(controller.getOne));
  router.put('/:id',     requireAuth, wrap(controller.update));
  router.delete('/:id',  requireAuth, wrap(controller.remove));
  router.patch('/:id/canonical', requireCanonicalManager, wrap(controller.setCanonical));

  return router;
}

// Корінь сервіса — лише читання наскрізь по чотирьох таблицях. Запис іде на
// ендпоінт конкретного виду, бо саме він визначає набір полів.
const unionRouter = express.Router();
unionRouter.get('/',    requireAuth, wrap(UnionController.list));
unionRouter.get('/:id', requireAuth, wrap(UnionController.getOne));

module.exports = { createCatalogRouter, unionRouter };
