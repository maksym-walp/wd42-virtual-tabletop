const RelationshipModel = require('../models/relationship.model');
const FactionModel = require('../models/faction.model');
const CharacterAccessModel = require('../models/character-access.model');
const { isAdmin } = require('./access');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Звʼязки й фракції з боку персонажа гравця (вкладка «Наратив» листа).
// Пускаємо тих самих, хто бачить лист персонажа (character-sheet getSheet):
// адмін, майстер (role game_master), власник, будь-хто для публічного,
// майстер кампанії, до якої персонаж прикріплений.
async function canViewCharacter(characterId, user) {
  if (isAdmin(user) || user.role === 'game_master') return true;
  return CharacterAccessModel.canView(characterId, user.sub);
}

async function guard(req, res) {
  const { characterId } = req.params;
  if (!UUID_RE.test(characterId)) { res.status(400).json({ message: 'Некоректний id персонажа' }); return false; }
  if (!await canViewCharacter(characterId, req.user)) {
    res.status(404).json({ message: 'Персонажа не знайдено' });
    return false;
  }
  return true;
}

const CharacterLinksController = {
  async relationships(req, res) {
    if (!await guard(req, res)) return;
    const relationships = await RelationshipModel.findByCharacterTarget(
      req.params.characterId, req.user.sub, isAdmin(req.user),
    );
    res.json({ relationships });
  },

  async factions(req, res) {
    if (!await guard(req, res)) return;
    const factions = await FactionModel.findMembershipsByCharacter(
      req.params.characterId, req.user.sub, isAdmin(req.user),
    );
    res.json({ factions });
  },
};

module.exports = CharacterLinksController;
