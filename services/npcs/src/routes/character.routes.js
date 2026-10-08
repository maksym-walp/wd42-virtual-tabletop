const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const CharacterLinksController = require('../controllers/character-links.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

// Персонажі гравців живуть у character_sheet; тут лише їхні звʼязки з НІПами
// і членство у фракціях — дані цього сервісу, подивлені з боку персонажа.
router.get('/:characterId/relationships', wrap(CharacterLinksController.relationships));
router.get('/:characterId/factions', wrap(CharacterLinksController.factions));

module.exports = router;
