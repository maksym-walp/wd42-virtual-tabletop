const express = require('express');
const multer = require('multer');
const requireAuth = require('../middleware/auth.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');
const BackupController = require('../controllers/backup.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Файли тримаються в пам'яті: БД займає одиниці-десятки МБ, а відновлення
// однаково читає кожен файл цілком. Ліміт має збігатися з client_max_body_size
// для /api/admin/ у nginx.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024, files: 500 },
});

router.use(requireAuth, requireAdmin);

router.get('/', wrap(BackupController.download));
router.post('/restore', upload.array('files'), wrap(BackupController.restore));

module.exports = router;
