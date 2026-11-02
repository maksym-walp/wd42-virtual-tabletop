const SpellModel = require('../models/spell.model');
const { canonicalOnCreate } = require('../middleware/auth.middleware');

// Поля, яких немає (чи не має бути) в експортованому JSON: image_url лежить
// на диску конкретного деплою; created_at/updated_at/is_owner/owner_username/
// is_canonical — обчислені чи прив'язані до поточного користувача/деплою;
// traditions — приєднані в findAll/findById, не справжня колонка.
const EXPORT_OMIT_FIELDS = [
  'image_url', 'image_crop', 'created_at', 'updated_at', 'is_owner', 'owner_username',
  'is_canonical', 'traditions',
];

function sanitizeForExport(row) {
  const clean = { ...row };
  for (const field of EXPORT_OMIT_FIELDS) delete clean[field];
  return clean;
}

const SpellController = {
  async list(req, res) {
    const { nature, spell_kind, ritual, complexity, search, sort, scope, limit, tradition } = req.query;
    const spells = await SpellModel.findAll(req.user.sub, { nature, spellKind: spell_kind, ritual, complexity, search, sort, scope, limit, traditionId: tradition }, req.user.role === 'admin');
    res.json({ spells });
  },

  async getOne(req, res) {
    const spell = await SpellModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!spell) return res.status(404).json({ message: 'Заклинання не знайдено' });
    res.json({ spell });
  },

  async create(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const spell = await SpellModel.create(req.user.sub, { ...req.body, is_canonical: canonicalOnCreate(req) });
    res.status(201).json({ spell });
  },

  async update(req, res) {
    const spell = await SpellModel.update(req.params.id, req.user.sub, req.body, req.user.role === 'admin');
    if (!spell) return res.status(404).json({ message: 'Заклинання не знайдено або недостатньо прав' });
    res.json({ spell });
  },

  async remove(req, res) {
    const deleted = await SpellModel.delete(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!deleted) return res.status(404).json({ message: 'Заклинання не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },

  // GM/admin only (route-gated) — mark someone else's spell canonical.
  async setCanonical(req, res) {
    const isCanonical = req.body.is_canonical ?? true;
    const spell = await SpellModel.setCanonical(req.params.id, isCanonical);
    if (!spell) return res.status(404).json({ message: 'Заклинання не знайдено' });
    res.json({ spell });
  },

  // Admin only (route-gated) — reassign a spell's owner without changing anything else.
  async setOwner(req, res) {
    const { owner_username } = req.body;
    if (!owner_username) return res.status(400).json({ message: 'owner_username є обовʼязковим' });
    const spell = await SpellModel.setOwner(req.params.id, owner_username);
    if (!spell) return res.status(404).json({ message: 'Запис не знайдено або користувача з таким іменем не існує' });
    res.json({ spell });
  },

  // Той самий набір фільтрів, що й у списку (GET /), плюс ?id= для експорту
  // рівно одного запису — той самий результат, що дав би /:id, лише
  // обгорнутий у масив з одним елементом.
  async export(req, res) {
    const isAdmin = req.user.role === 'admin';
    let items;
    if (req.query.id) {
      const spell = await SpellModel.findById(req.query.id, req.user.sub, isAdmin);
      items = spell ? [spell] : [];
    } else {
      const { nature, spell_kind, ritual, complexity, search, sort, scope, limit, tradition } = req.query;
      items = await SpellModel.findAll(
        req.user.sub,
        { nature, spellKind: spell_kind, ritual, complexity, search, sort, scope, limit, traditionId: tradition },
        isAdmin
      );
    }
    res.json(items.map(sanitizeForExport));
  },

  async kinds(req, res) {
    res.json({ spell_kinds: await SpellModel.getKindOptions() });
  },

  async magicForms(req, res) {
    res.json({ magic_forms: await SpellModel.getMagicFormOptions() });
  },

  async getRelated(req, res) {
    const related = await SpellModel.getRelated(req.params.id, req.user.sub, req.user.role === 'admin');
    res.json({ related });
  },

  async addRelated(req, res) {
    const { related_id } = req.body;
    if (!related_id) return res.status(400).json({ message: 'related_id є обовʼязковим' });
    const link = await SpellModel.addRelated(req.params.id, related_id, req.user.sub, req.user.role === 'admin');
    if (!link) return res.status(404).json({ message: 'Заклинання не знайдено або недостатньо прав' });
    res.status(201).json({ link });
  },

  async removeRelated(req, res) {
    const removed = await SpellModel.removeRelated(req.params.id, req.params.relatedId, req.user.sub, req.user.role === 'admin');
    if (!removed) return res.status(404).json({ message: 'Зв\'язок не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },

  // GM/admin only (route-gated) — масовий імпорт раніше експортованого JSON.
  // Upsert: a record whose "id" or "name" (case-insensitive) matches a
  // spell this importer may already write to (own, or any if admin)
  // updates it in place instead of creating a duplicate — keeping that
  // record's image_url/image_crop, which the import never carries.
  async import(req, res) {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Очікується масив обʼєктів' });
    }
    const isAdmin = req.user.role === 'admin';
    const existing = await SpellModel.findAll(req.user.sub, {}, isAdmin);
    const writable = isAdmin ? existing : existing.filter((r) => r.user_id === req.user.sub);
    const byId = new Map(writable.map((r) => [r.id, r]));
    const byName = new Map(writable.map((r) => [r.name.trim().toLowerCase(), r]));

    let created = 0;
    let updated = 0;
    for (const record of req.body) {
      if (!record || !record.name) continue;
      const match = (record.id && byId.get(record.id)) || byName.get(String(record.name).trim().toLowerCase());
      if (match) {
        await SpellModel.update(match.id, req.user.sub, {
          ...record, image_url: match.image_url, image_crop: match.image_crop,
        }, isAdmin);
        updated += 1;
      } else {
        await SpellModel.create(req.user.sub, { ...record, is_canonical: true });
        created += 1;
      }
    }
    res.status(201).json({ imported: created + updated, created, updated });
  },
};

module.exports = SpellController;
module.exports.sanitizeForExport = sanitizeForExport;
