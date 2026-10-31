const CombatSceneModel = require('../models/combat-scene.model');
const CombatantModel = require('../models/combatant.model');
const CombatLogModel = require('../models/combat-log.model');
const CampaignModel = require('../models/campaign.model');
const CampaignCharacterModel = require('../models/campaign-character.model');
const bus = require('../realtime/bus');
const { loadCampaignOr404, canManage, canView, isAdmin } = require('./load-campaign');
const { deriveCombatStats } = require('../utils/compendium-combat-stats');
const { resolveAttack } = require('../utils/attack');
const CharacterSheetClient = require('../clients/character-sheet.client');
const { fatigueNotifications } = require('./timer.controller');

const HIDDEN_COMBATANT_FIELDS = ['id', 'name', 'description', 'is_hidden'];

// Upper bound on a single "add from compendium" batch — guards against a
// mistyped quantity accidentally flooding the tracker with rows.
const MAX_COMPENDIUM_QUANTITY = 20;

// Поля, які гравець (не GM) сміє міняти на СВОЄМУ комбатанті: ХП (розумний
// парсинг +N/-N/N на фронті вже звівся до цих двох чисел), захисти й
// ініціативу (або з кидка кубика на сайті, або вручну — за столом гравці
// часто кидають фізичні кубики) і власні примітки. Усе інше — лише GM.
const PLAYER_EDITABLE_FIELDS = [
  'health', 'temp_hp', 'initiative', 'active_defense', 'passive_defense', 'notes',
  // Трекер дій і позначка залишеної реакції — теж самообслуговування:
  // гравець сам відмічає, скільки дій витратив і чи лишив дію на реакцію.
  'reaction_reserved', 'actions_used', 'actions_log',
];

// Прихований від гравців комбатант (is_hidden) віддає лише картку-заглушку:
// жодних чисел здоров'я/захисту/ініціативи чи нотаток GM, доки його не розкрито.
function redactForPlayers(combatant) {
  if (!combatant.is_hidden) return combatant;
  const redacted = {};
  for (const key of HIDDEN_COMBATANT_FIELDS) redacted[key] = combatant[key];
  return redacted;
}

const CombatController = {
  async getCurrent(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;

    const gm = canManage(campaign, req.user);
    if (!gm && !await CampaignCharacterModel.isMember(campaign.id, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    const scene = await CombatSceneModel.findCurrentByCampaign(campaign.id);
    if (!scene) return res.json({ scene: null, combatants: [] });

    const combatants = await CombatantModel.listByScene(scene.id);
    const visible = gm ? combatants : combatants.map(redactForPlayers);
    // Журнал пояснює гравцеві, чому в нього змінилися числа, навіть якщо
    // кидав хтось інший. Записи про прихованих комбатантів — лише ГМ.
    const log = await CombatLogModel.listByScene(scene.id, { includeGmOnly: gm });
    res.json({ scene, combatants: visible, log });
  },

  async createScene(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!canManage(campaign, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const scene = await CombatSceneModel.create(campaign.id, { image_url: req.body.image_url });
    bus.publish(campaign.id, 'combat');
    res.status(201).json({ scene });
  },

  async updateScene(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!canManage(campaign, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { image_url, round_number } = req.body;
    const scene = await CombatSceneModel.update(req.params.sceneId, campaign.id, { image_url, round_number });
    if (!scene) return res.status(404).json({ message: 'Сцену не знайдено' });
    bus.publish(campaign.id, 'combat');
    res.json({ scene });
  },

  async removeScene(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!canManage(campaign, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const removed = await CombatSceneModel.remove(req.params.sceneId, campaign.id);
    if (!removed) return res.status(404).json({ message: 'Сцену не знайдено' });
    bus.publish(campaign.id, 'combat');
    res.status(204).send();
  },

  async addCombatant(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!canManage(campaign, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const scene = await CombatSceneModel.findById(req.params.sceneId, campaign.id);
    if (!scene) return res.status(404).json({ message: 'Сцену не знайдено' });

    const { compendium_entry_id: compendiumEntryId } = req.body;
    if (compendiumEntryId) {
      const entry = await CampaignModel.findCompendiumEntry(compendiumEntryId, req.user.sub, isAdmin(req.user));
      if (!entry) return res.status(404).json({ message: 'Запис компендіуму не знайдено' });

      const quantity = Math.min(Math.max(parseInt(req.body.quantity, 10) || 1, 1), MAX_COMPENDIUM_QUANTITY);
      const { maxHealth, activeDefense, initiative } = deriveCombatStats(entry);
      const combatantsData = Array.from({ length: quantity }, (_, i) => ({
        compendium_entry_id: entry.id,
        name: quantity === 1 ? entry.name : `${entry.name} ${i + 1}`,
        passive_defense: 0,
        active_defense: activeDefense,
        health: maxHealth,
        max_health: maxHealth,
        temp_hp: 0,
        initiative,
      }));

      const combatants = await CombatantModel.addMany(scene.id, combatantsData);
      bus.publish(campaign.id, 'combat');
      return res.status(201).json({ combatants });
    }

    const { character_id, name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name є обовʼязковим' });

    if (character_id) {
      const character = await CampaignModel.findCharacterOwner(character_id);
      if (!character) return res.status(404).json({ message: 'Персонажа не знайдено' });
    }

    const combatant = await CombatantModel.add(scene.id, { ...req.body, name: name.trim() });
    bus.publish(campaign.id, 'combat');
    res.status(201).json({ combatant });
  },

  async updateCombatant(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;

    if (!canManage(campaign, req.user)) {
      const onlySelfServiceFields = Object.keys(req.body).every((key) => PLAYER_EDITABLE_FIELDS.includes(key));
      if (!onlySelfServiceFields) return res.status(403).json({ message: 'Доступ заборонено' });

      const owns = await CombatantModel.isOwnedByUser(req.params.combatantId, campaign.id, req.user.sub);
      if (!owns) return res.status(403).json({ message: 'Доступ заборонено' });
    }

    const combatant = await CombatantModel.update(req.params.combatantId, campaign.id, req.body);
    if (!combatant) return res.status(404).json({ message: 'Комбатанта не знайдено' });
    bus.publish(campaign.id, 'combat');
    res.json({ combatant });
  },

  async removeCombatant(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!canManage(campaign, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const removed = await CombatantModel.remove(req.params.combatantId, campaign.id);
    if (!removed) return res.status(404).json({ message: 'Комбатанта не знайдено' });
    bus.publish(campaign.id, 'combat');
    res.status(204).send();
  },

  // Наступний хід: серед тих, хто ще не діяв цього раунду, обирає найвищу
  // ініціативу і позначає, що він походив.
  async nextTurn(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!canManage(campaign, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const scene = await CombatSceneModel.findCurrentByCampaign(campaign.id);
    if (!scene) return res.status(404).json({ message: 'Активної бойової сцени не знайдено' });
    if (scene.ended_at) return res.status(409).json({ message: 'Бій уже завершено' });

    const next = await CombatantModel.findNextToAct(scene.id);
    if (!next) return res.status(404).json({ message: 'Усі комбатанти вже походили цього раунду' });

    const combatant = await CombatantModel.markActed(next.id);
    bus.publish(campaign.id, 'combat');
    res.json({ combatant });
  },

  async nextRound(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!canManage(campaign, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const scene = await CombatSceneModel.findCurrentByCampaign(campaign.id);
    if (!scene) return res.status(404).json({ message: 'Активної бойової сцени не знайдено' });
    if (scene.ended_at) return res.status(409).json({ message: 'Бій уже завершено' });

    const updated = await CombatSceneModel.advanceRound(scene.id, campaign.id);
    bus.publish(campaign.id, 'combat');
    res.json({ scene: updated });
  },

  // Завершення бою: кожен розпочатий раунд — година таймера діяльності
  // кожному персонажу-учаснику. Спершу години (ідемпотентно через
  // source_key = combat:<sceneId>), потім позначка ended_at — тож повтор
  // після 502 безпечний, а повторне натискання годин не додає.
  async endCombat(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!canManage(campaign, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const scene = await CombatSceneModel.findCurrentByCampaign(campaign.id);
    if (!scene) return res.status(404).json({ message: 'Активної бойової сцени не знайдено' });
    if (scene.ended_at) return res.json({ scene, already_ended: true, hours: 0, results: [], notifications: [] });

    const hours = Math.max(1, Number(scene.round_number) || 1);
    const combatants = await CombatantModel.listByScene(scene.id);
    const characterIds = [...new Set(combatants.map((c) => c.character_id).filter(Boolean))];

    let results = [];
    if (characterIds.length) {
      ({ results } = await CharacterSheetClient.advanceTimer(req.headers?.authorization, {
        characterIds, hours, sourceKey: `combat:${scene.id}`,
      }));
    }

    const ended = await CombatSceneModel.end(scene.id, campaign.id);
    bus.publish(campaign.id, 'combat');
    if (characterIds.length) bus.publish(campaign.id, 'characters');
    res.json({ scene: ended, already_ended: false, hours, results, notifications: fatigueNotifications(results) });
  },


  // POST /:id/combat/attack — розвʼязання атаки одним кроком.
  //
  // Кубики кидає клієнт через dice-roller (так гравець бачить розбивку, а
  // кидок лягає в його історію) і надсилає сюди результати: влучання
  // (total + natural на d20), ухилення цілі, якщо вона тримала реакцію, і
  // шкоду. Сервер рахує порівняння, зношування й поглинання (utils/attack.js),
  // записує обом рядкам нові числа, пише журнал і сповіщає сцену.
  //
  // Шкоду персонажу гравця застосовує character-sheet: поточний максимум
  // здоровʼя, Травма, масивна шкода й шкала смерті — його правила.
  async attack(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;

    const { attacker_id, target_id, hit, dodge, damage, weapon } = req.body || {};
    if (!attacker_id || !target_id) {
      return res.status(400).json({ message: 'attacker_id і target_id є обовʼязковими' });
    }
    if (attacker_id === target_id) {
      return res.status(400).json({ message: 'Комбатант не може атакувати сам себе' });
    }
    if (!hit || !Number.isFinite(Number(hit.total))) {
      return res.status(400).json({ message: 'hit.total — результат кидка влучання' });
    }

    const gm = canManage(campaign, req.user);
    // Атака пише в рядок ЦІЛІ, тож звичайна перевірка «свій рядок» не
    // підходить: гравцеві дозволено бити лише СВОЇМ комбатантом.
    if (!gm && !await CombatantModel.isOwnedByUser(attacker_id, campaign.id, req.user.sub)) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    const scene = await CombatSceneModel.findCurrentByCampaign(campaign.id);
    if (!scene) return res.status(404).json({ message: 'Активної бойової сцени не знайдено' });
    if (scene.ended_at) return res.status(409).json({ message: 'Бій уже завершено' });

    const attacker = await CombatantModel.findInCampaign(attacker_id, campaign.id);
    const target = await CombatantModel.findInCampaign(target_id, campaign.id);
    if (!attacker || !target) return res.status(404).json({ message: 'Комбатанта не знайдено' });
    if (attacker.combat_scene_id !== scene.id || target.combat_scene_id !== scene.id) {
      return res.status(404).json({ message: 'Комбатант не з цієї сцени' });
    }

    // Ухилення: ціль тримала реакцію, і клієнт уже кинув за неї кубик
    // (4.5.1). Новий результат замінює наявний активний захист лише якщо
    // він вищий; прапорець реакції знімається в будь-якому разі.
    let activeDefense = Number(target.active_defense) || 0;
    let dodged = null;
    if (dodge && target.reaction_reserved) {
      const rolled = Math.max(0, Math.trunc(Number(dodge.total) || 0));
      activeDefense = Math.max(activeDefense, rolled);
      await CombatantModel.applyDodge(target.id, activeDefense);
      dodged = { rolled, formula: dodge.formula ?? null, active_defense: activeDefense };
    }

    const outcome = resolveAttack({
      total: hit.total,
      natural: hit.natural,
      passive_defense: target.passive_defense,
      active_defense: activeDefense,
      damage: damage?.total,
    });

    // Зношування пасивного захисту цілі (4.4.2) — навіть при нічиїй.
    if (outcome.passive_after !== (Number(target.passive_defense) || 0)) {
      await CombatantModel.update(target.id, campaign.id, { passive_defense: outcome.passive_after });
    }

    // Шкода. Персонажу — через character-sheet (там максимум здоровʼя й
    // пороги станів); НІПу — просто віднімаємо числа тут.
    let sheet = null;
    let targetRow = await CombatantModel.findInCampaign(target.id, campaign.id);
    if (outcome.hp_damage > 0) {
      if (target.character_id) {
        sheet = await CharacterSheetClient.applyDamage(
          req.headers?.authorization, target.character_id, outcome.hp_damage
        );
        targetRow = await CombatantModel.update(target.id, campaign.id, {
          health: sheet.result.hp_after, temp_hp: sheet.result.temp_after,
        });
      } else {
        const temp = Number(targetRow.temp_hp) || 0;
        const fromTemp = Math.min(temp, outcome.hp_damage);
        targetRow = await CombatantModel.update(target.id, campaign.id, {
          temp_hp: temp - fromTemp,
          health: Math.max(0, (Number(targetRow.health) || 0) - (outcome.hp_damage - fromTemp)),
        });
      }
    }

    // Атака коштує дію — трекер і журнал повторень (4.2, 4.10).
    const attackerRow = await CombatantModel.spendAction(attacker.id, 'attack');

    const payload = {
      weapon: weapon ?? null,
      hit: { ...hit, ...outcome },
      dodge: dodged,
      damage: damage ? { ...damage, ...outcome } : null,
      sheet: sheet?.result ?? null,
    };
    const entry = await CombatLogModel.add(scene.id, {
      round_number: scene.round_number,
      actor: attacker,
      target,
      kind: 'attack',
      payload,
      // Журнал не має розкривати те, що ховає таблиця.
      is_gm_only: attacker.is_hidden || target.is_hidden,
    });

    bus.publish(campaign.id, 'combat');
    if (target.character_id) bus.publish(campaign.id, 'characters');

    res.json({
      outcome, dodge: dodged, log_entry: entry,
      attacker: attackerRow, target: targetRow,
      sheet: sheet?.result ?? null,
    });
  },

  // POST /:id/combat/log — кидок, що нікого не атакує (ініціатива, рятівний
  // кидок від смерті, окреме ухилення), але який теж має бути видимим.
  async addLogEntry(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;

    const { combatant_id, kind, payload } = req.body || {};
    if (!['dodge', 'initiative', 'death_save', 'damage'].includes(kind)) {
      return res.status(400).json({ message: 'kind має бути dodge, initiative, death_save або damage' });
    }

    const gm = canManage(campaign, req.user);
    if (!gm && !await CombatantModel.isOwnedByUser(combatant_id, campaign.id, req.user.sub)) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    const scene = await CombatSceneModel.findCurrentByCampaign(campaign.id);
    if (!scene) return res.status(404).json({ message: 'Активної бойової сцени не знайдено' });

    const combatant = await CombatantModel.findInCampaign(combatant_id, campaign.id);
    if (!combatant || combatant.combat_scene_id !== scene.id) {
      return res.status(404).json({ message: 'Комбатанта не знайдено' });
    }

    const entry = await CombatLogModel.add(scene.id, {
      round_number: scene.round_number,
      actor: combatant,
      target: null,
      kind,
      payload: payload ?? {},
      is_gm_only: combatant.is_hidden,
    });
    bus.publish(campaign.id, 'combat');
    res.status(201).json({ log_entry: entry });
  },

  // Зворотний бік двосторонньої синхронізації: лист персонажа сповіщає сюди
  // про зміну ХП, а ми знаходимо ВСІХ його комбатантів (у будь-якій
  // кампанії/сцені) і оновлюємо їх — не знаючи наперед, у якому бою він зараз.
  async syncHpFromCharacterSheet(req, res) {
    const character = await CampaignModel.findCharacterOwner(req.params.characterId);
    if (!character) return res.status(404).json({ message: 'Персонажа не знайдено' });
    if (character.user_id !== req.user.sub && !isAdmin(req.user)
      && !await CampaignModel.isCampaignGmForCharacter(req.params.characterId, req.user.sub)) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    const { health, temp_hp } = req.body;
    const combatants = await CombatantModel.updateHpByCharacterId(req.params.characterId, { health, temp_hp });
    const campaignIds = await CampaignModel.campaignIdsForCharacter(req.params.characterId);
    for (const campaignId of campaignIds) {
      bus.publish(campaignId, 'combat');
      bus.publish(campaignId, 'characters');
    }
    res.json({ combatants });
  },
};

module.exports = CombatController;
