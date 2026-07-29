const CampaignModel = require('../models/campaign.model');
const CampaignCharacterModel = require('../models/campaign-character.model');

const CampaignCharacterController = {
  // Спосіб А: гравець сам приєднує власного персонажа за invite_code
  async join(req, res) {
    const { invite_code, character_id } = req.body;
    if (!invite_code || !character_id) {
      return res.status(400).json({ message: 'invite_code та character_id є обовʼязковими' });
    }

    const campaign = await CampaignModel.findByInviteCode(invite_code);
    if (!campaign) return res.status(404).json({ message: 'Кампанію не знайдено' });

    const character = await CampaignModel.findCharacterOwner(character_id);
    if (!character) return res.status(404).json({ message: 'Персонажа не знайдено' });
    if (character.user_id !== req.user.sub) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    const added = await CampaignCharacterModel.add(campaign.id, character_id);
    if (!added) return res.status(200).json({ message: 'Персонаж вже приєднаний до цієї кампанії', campaign });
    res.status(201).json({ campaign, character_id });
  },

  // Спосіб Б: майстер напряму додає character_id до своєї кампанії
  async addByGm(req, res) {
    const campaign = await CampaignModel.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Кампанію не знайдено' });
    if (campaign.gm_id !== req.user.sub) return res.status(403).json({ message: 'Доступ заборонено' });

    const { character_id } = req.body;
    if (!character_id) return res.status(400).json({ message: 'character_id є обовʼязковим' });

    const character = await CampaignModel.findCharacterOwner(character_id);
    if (!character) return res.status(404).json({ message: 'Персонажа не знайдено' });

    const added = await CampaignCharacterModel.add(campaign.id, character_id);
    if (!added) return res.status(200).json({ message: 'Персонаж вже приєднаний до цієї кампанії' });
    res.status(201).json({ character_id });
  },

  async list(req, res) {
    const campaign = await CampaignModel.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Кампанію не знайдено' });

    const isGm = campaign.gm_id === req.user.sub;
    const isMember = isGm || await CampaignCharacterModel.isMember(campaign.id, req.user.sub);
    if (!isMember) return res.status(403).json({ message: 'Доступ заборонено' });

    const characters = await CampaignCharacterModel.listWithOwners(campaign.id);
    const visible = characters.map((ch) => {
      const isMine = ch.owner_id === req.user.sub;
      // Private characters belonging to someone else: card-only data, no
      // owner_email/added_at, and no way for the frontend to link into the sheet.
      if (!ch.is_public && !isMine) {
        return {
          character_id: ch.character_id,
          character_name: ch.character_name,
          image_url: ch.image_url,
          archetype: ch.archetype,
          race: ch.race,
          owner_username: ch.owner_username,
          is_mine: false,
          is_private: true,
        };
      }
      return { ...ch, is_mine: isMine, is_private: false };
    });
    res.json({ characters: visible });
  },

  // Майстер відв'язує персонажа від кампанії (сам лист персонажа не видаляється)
  async remove(req, res) {
    const campaign = await CampaignModel.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Кампанію не знайдено' });
    if (campaign.gm_id !== req.user.sub) return res.status(403).json({ message: 'Доступ заборонено' });

    await CampaignCharacterModel.remove(campaign.id, req.params.characterId);
    res.status(204).send();
  },

  // A player leaves the campaign: every character THEY own gets detached.
  // The GM can't "leave" their own campaign — they'd have to delete it.
  async leave(req, res) {
    const campaign = await CampaignModel.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Кампанію не знайдено' });
    if (campaign.gm_id === req.user.sub) {
      return res.status(400).json({ message: 'Майстер не може покинути власну кампанію' });
    }

    const removed = await CampaignCharacterModel.removeAllForUser(campaign.id, req.user.sub);
    if (!removed) return res.status(404).json({ message: 'Ви не берете участі в цій кампанії' });
    res.status(204).send();
  },
};

module.exports = CampaignCharacterController;
