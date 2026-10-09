const SpellProgressModel = require('../models/spell.model');
const { isVisibleToUser } = require('../models/prerequisite.model');
const { checkSpellAccess, isSpellMaster } = require('../models/spell-access.model');
const { resolveFormProgress } = require('../models/form-progress');
const authorizeCharacterWrite = require('./authorize-character-write');

// Поля освоєння форм (form_tier/primary_form/mastered_forms) перевіряє
// resolveFormProgress (form-progress.js) — проти форм самого заклинання й
// форм, які персонажу відкрило дерево розвитку (традиції + складність, див.
// spell-access.model.js). allowedForms: null — без обмежень (майстер або
// заклинання, видане майстром).
async function resolveSpellForms(spellId, body, { isAdd = false, allowedForms = null, current = null } = {}) {
  const keys = await SpellProgressModel.formKeys(spellId);
  if (!keys) return { error: 'Заклинання не знайдено' };
  return resolveFormProgress(keys, body, { isAdd, allowed: allowedForms, current });
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
    // Майстер дає заклинання поза правилами доступності — і такий запис
    // лишається поза ними й надалі (gm_granted).
    const master = await isSpellMaster(req, req.params.id);
    let allowedForms = null;
    if (!master) {
      const access = await checkSpellAccess(req.params.id, spell_id);
      if (!access.met) {
        return res.status(403).json({ message: 'Традицію чи складність заклинання ще не відкрито на дереві розвитку', missing: access.missing });
      }
      allowedForms = access.allowedForms;
    }
    const { error, progress } = await resolveSpellForms(spell_id, req.body, { isAdd: true, allowedForms });
    if (error) return res.status(400).json({ message: error });
    const entry = await SpellProgressModel.add(req.params.id, spell_id, { ...progress, gm_granted: master });
    res.status(201).json({ spell: entry });
  },

  async patch(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const { mastered, cast_count, form_tier, primary_form, mastered_forms } = req.body;
    let progress = {};
    if (form_tier !== undefined || primary_form !== undefined || mastered_forms !== undefined) {
      const current = await SpellProgressModel.findOne(req.params.id, req.params.spellId);
      const exempt = current?.gm_granted || await isSpellMaster(req, req.params.id);
      const allowedForms = exempt ? null : (await checkSpellAccess(req.params.id, req.params.spellId)).allowedForms;
      const resolved = await resolveSpellForms(req.params.spellId, { form_tier, primary_form, mastered_forms }, { allowedForms, current });
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
