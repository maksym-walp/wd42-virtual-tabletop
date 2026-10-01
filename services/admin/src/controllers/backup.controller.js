const path = require('path');
const AdmZip = require('adm-zip');
const BackupModel = require('../models/backup.model');

const FORMAT = 'walp-backup';
const FORMAT_VERSION = 1;

const badRequest = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

function timestamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

// Розгортає завантажені файли (архіви й/або окремі JSON) у плаский список
// { name, text }. name — basename без шляху всередині архіву.
function collectFiles(uploads) {
  const files = [];
  for (const upload of uploads) {
    const name = path.basename(upload.originalname);
    if (name.toLowerCase().endsWith('.zip')) {
      let zip;
      try {
        zip = new AdmZip(upload.buffer);
      } catch {
        throw badRequest(`${name}: не вдалося прочитати zip-архів`);
      }
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        files.push({ name: path.basename(entry.entryName), text: entry.getData().toString('utf8') });
      }
    } else {
      files.push({ name, text: upload.buffer.toString('utf8') });
    }
  }
  return files;
}

const BackupController = {
  // Архів: manifest.json + data/<schema>.<table>.json на кожну таблицю БД.
  async download(req, res) {
    const { tables, migrations } = await BackupModel.dumpAll();
    const createdAt = new Date();

    const zip = new AdmZip();
    zip.addFile('manifest.json', Buffer.from(JSON.stringify({
      format: FORMAT,
      version: FORMAT_VERSION,
      created_at: createdAt.toISOString(),
      created_by: req.user?.username || req.user?.sub || null,
      migrations,
      tables: Object.fromEntries(tables.map((t) => [t.key, t.rowCount])),
    }, null, 2)));
    for (const t of tables) {
      zip.addFile(`data/${t.key}.json`, Buffer.from(t.json));
    }

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="walp-backup_${timestamp(createdAt)}.zip"`,
    });
    res.send(zip.toBuffer());
  },

  // Повне відновлення — коли серед файлів є manifest.json (тобто завантажено
  // цілий архів): спорожнюються ВСІ таблиці, навіть ті, яких у бекапі нема.
  // Часткове — лише окремі JSON-файли: замінюються тільки вказані таблиці,
  // решта БД не чіпається.
  async restore(req, res) {
    if (!req.files?.length) throw badRequest('Не передано жодного файлу');

    const files = collectFiles(req.files);
    const current = await BackupModel.currentState();
    const known = new Set(current.tables);

    let manifest = null;
    const entries = new Map();
    const skipped = [];

    for (const { name, text } of files) {
      if (name === 'manifest.json') {
        try {
          manifest = JSON.parse(text);
        } catch {
          throw badRequest('manifest.json: некоректний JSON');
        }
        if (manifest?.format !== FORMAT) throw badRequest('manifest.json: це не бекап walp');
        if (manifest.version > FORMAT_VERSION) throw badRequest('Бекап створено новішою версією формату');
        continue;
      }
      if (!name.toLowerCase().endsWith('.json')) {
        skipped.push({ file: name, reason: 'не JSON' });
        continue;
      }
      const key = name.slice(0, -'.json'.length);
      if (key === BackupModel.MIGRATIONS_TABLE) {
        skipped.push({ file: name, reason: 'службова таблиця міграцій не відновлюється' });
        continue;
      }
      if (!known.has(key)) {
        skipped.push({ file: name, reason: 'такої таблиці немає в БД' });
        continue;
      }
      if (entries.has(key)) throw badRequest(`Таблицю ${key} передано двічі`);
      entries.set(key, text);
    }

    if (entries.size === 0) throw badRequest('Не знайдено жодного JSON-файлу таблиці (очікується <схема>.<таблиця>.json)');

    // Бекап із міграціями, яких ще немає в поточній БД, містить колонки/таблиці
    // під новішу схему — спершу треба накотити міграції, інакше дані
    // відновляться частково.
    const warnings = [];
    if (manifest?.migrations && current.migrations) {
      const applied = new Set(current.migrations);
      const missing = manifest.migrations.filter((m) => !applied.has(m));
      if (missing.length) {
        throw badRequest(`Бекап створено на новішій схемі БД. Спершу застосуйте міграції: ${missing.join(', ')}`, 409);
      }
      const inBackup = new Set(manifest.migrations);
      const newer = current.migrations.filter((m) => !inBackup.has(m));
      if (newer.length) warnings.push(`Бекап старший за поточну схему (${newer.length} міграцій після нього) — нові колонки отримають значення за замовчуванням`);
    }

    const full = manifest !== null;
    const clearKeys = full
      ? current.tables.filter((k) => k !== BackupModel.MIGRATIONS_TABLE)
      : [...entries.keys()];

    const restored = await BackupModel.restore(
      [...entries].map(([key, json]) => ({ key, json })),
      clearKeys
    );

    res.json({
      mode: full ? 'full' : 'partial',
      restored,
      cleared: clearKeys.filter((k) => !entries.has(k)),
      skipped,
      warnings,
    });
  },
};

module.exports = BackupController;
