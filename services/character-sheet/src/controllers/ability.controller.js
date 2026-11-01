const AbilityModel = require('../models/ability.model');
const { checkPrerequisites, isVisibleToUser } = require('../models/prerequisite.model');
const { resolveFormTier } = require('../models/form-progress');
const authorizeCharacterWrite = require('./authorize-character-write');

// form_tier — так само, як у заклинань (spell.controller.js).
async function resolveAbilityForms(characterId, abilityId, body, { isAdd = false, allowedForms } = {}) {
  const tiers = await AbilityModel.tiers(abilityId);
  if (!tiers) return { error: 'Вміння не знайдено' };
  let allowed = allowedForms;
  let current = null;
  if (!isAdd) {
    allowed = (await checkPrerequisites(characterId, 'abilities.entries', abilityId))?.allowedForms ?? null;
    current = await AbilityModel.findOne(characterId, abilityId);
  }
  return resolveFormTier(tiers, body, { isAdd, allowed, current });
}

const AbilityController = {
  async list(req, res) {
    const abilities = await AbilityModel.findAll(req.params.id);
    res.json({ abilities });
  },

  async add(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const { ability_id } = req.body;
    if (!ability_id) return res.status(400).json({ message: 'ability_id є обовʼязковим' });
    if (!await isVisibleToUser('abilities.entries', ability_id, req.user.sub)) {
      return res.status(404).json({ message: 'Вміння не знайдено' });
    }
    const { met, missing, allowedForms } = await checkPrerequisites(req.params.id, 'abilities.entries', ability_id);
    if (!met) return res.status(403).json({ message: 'Не виконано вимоги дерева розвитку', missing_node_ids: missing });
    const resolved = await resolveAbilityForms(req.params.id, ability_id, req.body, { isAdd: true, allowedForms });
    if (resolved.error) return res.status(400).json({ message: resolved.error });
    const ability = await AbilityModel.add(req.params.id, ability_id, { form_tier: resolved.form_tier });
    res.status(201).json({ ability });
  },

  async patch(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const { form_tier } = req.body;
    const resolved = await resolveAbilityForms(req.params.id, req.params.abilityId, { form_tier });
    if (resolved.error) return res.status(400).json({ message: resolved.error });
    const updated = await AbilityModel.patch(req.params.id, req.params.abilityId, { form_tier: resolved.form_tier });
    if (!updated) return res.status(404).json({ message: 'Вміння не знайдено в листі' });
    res.json({ ability: updated });
  },

  async remove(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const deleted = await AbilityModel.remove(req.params.id, req.params.abilityId);
    if (!deleted) return res.status(404).json({ message: 'Вміння не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = AbilityController;
