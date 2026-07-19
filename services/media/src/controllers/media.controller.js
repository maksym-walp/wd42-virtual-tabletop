const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { MIME_EXT, UPLOAD_DIR } = require('../config/upload');
const { resolveTarget } = require('../lib/resolve-target');
const { sniff } = require('../lib/sniff');

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
    // «очищений» лишався б зайвим вектором.
    const filename = `${crypto.randomUUID()}${MIME_EXT[req.file.mimetype]}`;

    await fs.promises.mkdir(absDir, { recursive: true, mode: 0o755 });
    await fs.promises.writeFile(path.join(absDir, filename), req.file.buffer, { mode: 0o644 });

    const url = `/uploads/${relDir}/${filename}`;
    // Сервіс не має БД, тож цей рядок — єдиний слід того, хто що завантажив.
    console.log(`[media] upload user=${req.user.sub} type=${entity_type} → ${url}`);

    res.status(201).json({ url });
  },
};

module.exports = MediaController;
