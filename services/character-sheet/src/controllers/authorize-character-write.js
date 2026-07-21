const CharacterModel = require('../models/character.model');
const { isCampaignGmForCharacter } = require('../models/campaign-access.model');

// Replaces the duplicated assertOwner() checks: allows the character's owner,
// an admin (full access to every user's records), OR the GM of any campaign
// the character is currently attached to.
async function authorizeCharacterWrite(req, res) {
  const char = await CharacterModel.findById(req.params.id);
  if (!char) { res.status(404).json({ message: 'Персонажа не знайдено' }); return null; }
  if (char.user_id === req.user.sub) return char;
  if (req.user.role === 'admin') return char;
  if (await isCampaignGmForCharacter(char.id, req.user.sub)) return char;
  res.status(403).json({ message: 'Доступ заборонено' });
  return null;
}

module.exports = authorizeCharacterWrite;
