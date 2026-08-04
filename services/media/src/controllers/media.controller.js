const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const { MIME_EXT, UPLOAD_DIR } = require('../config/upload');
const { resolveTarget } = require('../lib/resolve-target');
const { sniff } = require('../lib/sniff');

const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_WEBP_QUALITY = 80;

const MediaController = {
  async upload(req, res) {
    if (!req.file) return res.status(400).json({ message: 'Файл не надіслано' });

    const { entity_type, entity_id } = req.body;
    // Кидає 400 на невідомий тип, невалідний UUID або шлях поза UPLOAD_DIR.
    const { relDir, absDir } = resolveTarget(entity_type, entity_id, UPLOAD_DIR);

    if (!sniff(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ message: 'Файл не є коректним зображенням' });
    }

    // Ім'я — випадковий UUID + розширення з MIME-мапи. originalname не
    // використовується: він міг би містити роздільники шляху, і навіть
    // «очищений» лишався б зайвим вектором. Мініатюра ділить той самий UUID,
    // лише з суфіксом, щоб пара файлів лишалась очевидно повʼязаною.
    const uuid = crypto.randomUUID();
    const filename = `${uuid}${MIME_EXT[req.file.mimetype]}`;
    const thumbnailFilename = `${uuid}_thumb.webp`;

    const thumbnailBuffer = await sharp(req.file.buffer)
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMBNAIL_WEBP_QUALITY })
      .toBuffer();

    await fs.promises.mkdir(absDir, { recursive: true, mode: 0o755 });
    await fs.promises.writeFile(path.join(absDir, filename), req.file.buffer, { mode: 0o644 });
    await fs.promises.writeFile(path.join(absDir, thumbnailFilename), thumbnailBuffer, { mode: 0o644 });

    const image_url = `/uploads/${relDir}/${filename}`;
    const thumbnail_url = `/uploads/${relDir}/${thumbnailFilename}`;
    // Сервіс не має БД, тож цей рядок — єдиний слід того, хто що завантажив.
    console.log(`[media] upload user=${req.user.sub} type=${entity_type} → ${image_url}`);

    res.status(201).json({ image_url, thumbnail_url });
  },
};

module.exports = MediaController;
