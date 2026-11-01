const authorizeCharacterWrite = require('./authorize-character-write');
const CharacterStateModel = require('../models/character-state.model');
const { treeModifiers } = require('../models/tree-modifiers.model');
const { sheetDerived } = require('../rules');
const { applyDamage, applyDeathSave } = require('../rules/combat');

// Бойові наслідки для персонажа: шкода й рятівні кидки від смерті.
// Саме порівняння влучання з захистом і зношування рахує трекер бою
// (campaigns) — захист лежить на комбатанті. Сюди приходить уже
// поглинута шкода, бо далі починаються правила листа: поточний максимум
// здоровʼя, шкала смерті й пороги Травми та масивної шкоди.

const CombatController = {
  // POST /:id/damage { amount, temp_hp? } — шкода, що вже пройшла пасивний
  // захист. Пропозицію Травми повертаємо, але самі не застосовуємо: розділ
  // 5.2.3 лишає майстру вибір, яку частину тіла пошкоджено.
  async damage(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ message: 'amount — невідʼємне число' });
    }

    const out = await CharacterStateModel.withCharacterLock(req.params.id, async (client, state) => {
      const result = applyDamage(state.character, state.skills, amount);
      const character = await CharacterStateModel.saveState(client, req.params.id, {
        current_hp: result.hp_after,
        temp_hp: result.temp_after,
        death_scale: result.death_scale,
      });
      return { result, character, skills: state.skills };
    });
    if (!out) return res.status(404).json({ message: 'Персонажа не знайдено' });

    res.json({
      result: out.result,
      character: out.character,
      ...sheetDerived(out.character, out.skills, await treeModifiers(out.character.id)),
    });
  },

  // POST /:id/magic/spend { amount } — витрата магічної енергії (розділ
  // 9.1): каст заклинання з трекера бою (campaigns -> POST
  // /:id/combat/cast) чи будь-яке інше списання. Лише перевіряє, що
  // вистачає, і списує — максимум і відновлення рахує rest.js.
  async spendMagic(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ message: 'amount — невідʼємне число' });
    }

    const out = await CharacterStateModel.withCharacterLock(req.params.id, async (client, state) => {
      const before = Number(state.character.current_magic) || 0;
      if (amount > before) return { insufficient: true, before, character: state.character, skills: state.skills };
      const character = await CharacterStateModel.saveState(client, req.params.id, {
        current_magic: before - amount,
      });
      return { insufficient: false, before, after: before - amount, character, skills: state.skills };
    });
    if (!out) return res.status(404).json({ message: 'Персонажа не знайдено' });
    if (out.insufficient) {
      return res.status(400).json({ message: 'Недостатньо магічної енергії', magic_before: out.before, spent: amount });
    }

    res.json({
      result: { magic_before: out.before, magic_after: out.after, spent: amount },
      character: out.character,
      ...sheetDerived(out.character, out.skills, await treeModifiers(out.character.id)),
    });
  },

  // POST /:id/death-save { rolled } — результат кидка d12 приходить з
  // клієнта (кидає dice-roller, щоб гравець бачив кубик), а зсув маркера й
  // пробудження на +3 лишаються тут.
  async deathSave(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;

    const rolled = Number(req.body?.rolled);
    if (!Number.isInteger(rolled) || rolled < 1 || rolled > 12) {
      return res.status(400).json({ message: 'rolled — ціле від 1 до 12 (кидок d12)' });
    }

    const out = await CharacterStateModel.withCharacterLock(req.params.id, async (client, state) => {
      const result = applyDeathSave(state.character, rolled);
      if (!result) return { result: null, character: state.character, skills: state.skills };
      const character = await CharacterStateModel.saveState(client, req.params.id, {
        death_scale: result.death_scale,
        // Прокидається з 1 здоровʼям (5.3.5); решту наслідків пробудження
        // (зниження станів) робить нормалізація при наступному записі станів.
        ...(result.awake ? { current_hp: Math.max(1, Number(state.character.current_hp) || 0) } : {}),
      });
      return { result, character, skills: state.skills };
    });
    if (!out) return res.status(404).json({ message: 'Персонажа не знайдено' });
    if (!out.result) {
      return res.status(400).json({ message: 'Персонаж не на шкалі смерті' });
    }

    res.json({
      result: out.result,
      character: out.character,
      ...sheetDerived(out.character, out.skills, await treeModifiers(out.character.id)),
    });
  },
};

module.exports = CombatController;
