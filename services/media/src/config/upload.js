const multer = require('multer');

// Розширення береться ЗВІДСИ, а не з file.originalname — ім'я від клієнта
// не читається ніколи й ніде.
const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 МБ; nginx пропускає 12m на цей location
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/uploads';

// memoryStorage, а не diskStorage: destination() у diskStorage спрацьовує в
// момент, коли парсер натрапляє на файлову частину, і бачить лише текстові
// поля, що йшли ПЕРЕД нею. Динамічний шлях залежав би від порядку полів у
// формі. До того ж memoryStorage дає провалідувати все до запису на диск.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 10, parts: 12 },
  fileFilter: (req, file, cb) => {
    if (!Object.prototype.hasOwnProperty.call(MIME_EXT, file.mimetype)) {
      return cb(Object.assign(
        new Error('Дозволені лише зображення: JPEG, PNG, WebP, GIF'),
        { statusCode: 400 }
      ));
    }
    cb(null, true);
  },
});

module.exports = { upload, MIME_EXT, MAX_BYTES, UPLOAD_DIR };
