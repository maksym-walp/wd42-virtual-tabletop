const SpellProgressModel = require('../models/spell.model');
const { checkPrerequisites, isVisibleToUser } = require('../models/prerequisite.model');
const authorizeCharacterWrite = require('./authorize-character-write');

// Перевіряє й нормалізує поля освоєння форм з тіла запиту проти форм
// самого заклинання. Повертає { error } або { progress } лише з переданими
// полями (для add — із дефолтами):
//   form_tier      — 'full' або наявна рівнева форма; лише для заклинань
//                    з рівневими формами (при add типово — найнижча);
//   primary_form   — 'main' або id альтернативної форми;
//   mastered_forms — ключі з того самого набору; невідомі тихо відкидаються.
async function resolveFormProgress(spellId, body, { isAdd = false } = {}) {
  const keys = await SpellProgressModel.formKeys(spellId);
  if (!keys) return { error: 'Заклинання не знайдено' };
  const tiers = keys.tierKinds.length ? ['primitive', 'full', 'perfected'].filter((t) => t === 'full' || keys.tierKinds.includes(t)) : [];
  const formIds = ['main', ...keys.altIds];
  const progress = {};

  if (body.form_tier !== undefined) {
    if (!tiers.includes(body.form_tier)) return { error: 'Некоректна рівнева форма' };
    progress.form_tier = body.form_tier;
  } else if (isAdd) {
    progress.form_tier = tiers[0] ?? null;
  }

  if (body.primary_form !== undefined) {
    if (!formIds.includes(body.primary_form)) return { error: 'Некоректна основна форма' };
    progress.primary_form = body.primary_form;
  } else if (isAdd) {
    progress.primary_form = 'main';
  }

  if (body.mastered_forms !== undefined) {
    if (!Array.isArray(body.mastered_forms)) return { error: 'mastered_forms має бути масивом' };
    progress.mastered_forms = [...new Set(body.mastered_forms)].filter((f) => formIds.includes(f));
  } else if (isAdd) {
    progress.mastered_forms = [progress.primary_form];
  }

  return { progress };
}

const SpellController = {
  async list(req, res) {
    const spells = await SpellProgressModel.findAll(req.params.id);
    res.json({ spells });
  },

  async add(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const { spell_id } = req.body;
    if (!spell_id) return res.status(400).json({ message: 'spell_id є обовʼязковим' });
    if (!await isVisibleToUser('spellbook.spells', spell_id, req.user.sub)) {
      return res.status(404).json({ message: 'Заклинання не знайдено' });
    }
    const { met, missing } = await checkPrerequisites(req.params.id, 'spellbook.spells', spell_id);
    if (!met) return res.status(403).json({ message: 'Не виконано вимоги дерева розвитку', missing_node_ids: missing });
    const { error, progress } = await resolveFormProgress(spell_id, req.body, { isAdd: true });
    if (error) return res.status(400).json({ message: error });
    const entry = await SpellProgressModel.add(req.params.id, spell_id, progress);
    res.status(201).json({ spell: entry });
  },

  async patch(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const { mastered, cast_count, form_tier, primary_form, mastered_forms } = req.body;
    let progress = {};
    if (form_tier !== undefined || primary_form !== undefined || mastered_forms !== undefined) {
      const resolved = await resolveFormProgress(req.params.spellId, { form_tier, primary_form, mastered_forms });
      if (resolved.error) return res.status(400).json({ message: resolved.error });
      progress = resolved.progress;
    }
    const updated = await SpellProgressModel.patch(req.params.id, req.params.spellId, { mastered, cast_count, ...progress });
    if (!updated) return res.status(404).json({ message: 'Заклинання не знайдено в листі' });
    res.json({ spell: updated });
  },

  async remove(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const deleted = await SpellProgressModel.remove(req.params.id, req.params.spellId);
    if (!deleted) return res.status(404).json({ message: 'Заклинання не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = SpellController;
