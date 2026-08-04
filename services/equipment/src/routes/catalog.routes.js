const express = require('express');
const { createCatalogController, UnionController, getWeaponOptionsHandler } = require('../controllers/catalog.controller');
const { requireAuth, requireCanonicalManager } = require('../middleware/auth.middleware');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Мусить бути змонтований ДО загального роутера /weapons (createCatalogRouter),
// інакше його власний GET /:id прийме "options" за id. Лише читання, без
// admin-гейта — форма й фільтри зброї потрібні будь-якому залогіненому.
const weaponOptionsRouter = express.Router();
weaponOptionsRouter.get('/', requireAuth, wrap(getWeaponOptionsHandler));

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
// export/import мусять стояти ДО GET /:id — інакше той прийме "export" за id
// (той самий патерн, що й weaponOptionsRouter вище).
unionRouter.get('/export', requireAuth, wrap(UnionController.export));
unionRouter.post('/import', requireCanonicalManager, wrap(UnionController.import));
unionRouter.get('/',    requireAuth, wrap(UnionController.list));
unionRouter.get('/:id', requireAuth, wrap(UnionController.getOne));

module.exports = { createCatalogRouter, unionRouter, weaponOptionsRouter };
