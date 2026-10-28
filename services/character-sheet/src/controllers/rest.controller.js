const authorizeCharacterWrite = require('./authorize-character-write');
const SkillModel = require('../models/skill.model');
const CharacterStateModel = require('../models/character-state.model');
const { rest, previewRest, REST_KINDS } = require('../rules/rest');
const { sheetDerived } = require('../rules');

const RestController = {
  // GET /:id/rest/preview — що дасть кожна форма відпочинку зараз (без кидків
  // і без запису): підказка в меню відпочинку. Доступ — як до самого відпочинку.
  async preview(req, res) {
    const char = await authorizeCharacterWrite(req, res);
    if (!char) return;
    const skills = await SkillModel.findAll(char.id);
    const preview = Object.fromEntries(REST_KINDS.map((kind) => [kind, previewRest(kind, { character: char, skills })]));
    res.json({ preview });
  },

  // POST /:id/rest { kind, choice?: { condition } } — власник, ГМ кампанії
  // або адмін. Хто натиснув, той і обирає стан для зняття; без вибору, коли
  // він потрібен, — 400 { code: 'choice_required', options }. Результат
  // зберігається в last_rest, щоб його побачила й інша сторона.
  async rest(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;

    const { kind, choice } = req.body;
    if (!REST_KINDS.includes(kind)) {
      return res.status(400).json({ message: 'kind має бути short, full або long' });
    }

    let out;
    try {
      out = await CharacterStateModel.withCharacterLock(req.params.id, async (client, state) => {
        const { result, fields } = rest(kind, state, { choice: choice?.condition ?? null });
        const lastRest = {
          ...result,
          at: new Date().toISOString(),
          by: { user_id: req.user.sub, username: req.user.username ?? null },
        };
        const character = await CharacterStateModel.saveState(client, req.params.id, { ...fields, last_rest: lastRest });
        return { result: lastRest, character, skills: state.skills };
      });
    } catch (err) {
      if (err.code === 'choice_required') {
        return res.status(400).json({ message: err.message, code: err.code, options: err.options });
      }
      throw err;
    }
    if (!out) return res.status(404).json({ message: 'Персонажа не знайдено' });

    res.json({ result: out.result, character: out.character, ...sheetDerived(out.character, out.skills) });
  },
};

module.exports = RestController;
