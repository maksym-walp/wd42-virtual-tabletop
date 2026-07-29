jest.mock('../../models/campaign.model');
jest.mock('../../models/campaign-character.model');
jest.mock('../../models/combat-scene.model');
jest.mock('../../models/combatant.model');

const CampaignModel = require('../../models/campaign.model');
const CampaignCharacterModel = require('../../models/campaign-character.model');
const CombatSceneModel = require('../../models/combat-scene.model');
const CombatantModel = require('../../models/combatant.model');
const CombatController = require('../combat.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}

function mockReq({ body = {}, params = {}, user = { sub: 'user-1' } } = {}) {
  return { body, params, user };
}

beforeEach(() => jest.clearAllMocks());

describe('CombatController.getCurrent', () => {
  it('returns 404 when campaign is missing', async () => {
    CampaignModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();
    await CombatController.getCurrent(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when requester is neither GM nor member', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignCharacterModel.isMember.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'stranger' } });
    const res = mockRes();
    await CombatController.getCurrent(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns an empty scene/combatants payload when the campaign has no scene yet', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.findCurrentByCampaign.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CombatController.getCurrent(req, res);

    expect(res.json).toHaveBeenCalledWith({ scene: null, combatants: [] });
    expect(CombatantModel.listByScene).not.toHaveBeenCalled();
  });

  it('gives the GM full combatant data, including hidden ones', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.findCurrentByCampaign.mockResolvedValue({ id: 's1', round_number: 2 });
    CombatantModel.listByScene.mockResolvedValue([
      { id: 'cb1', name: 'Goblin', health: 7, initiative: 12, is_hidden: true, notes: 'weak', description: 'sneaky' },
      { id: 'cb2', name: 'Hero', health: 20, initiative: 18, is_hidden: false },
    ]);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CombatController.getCurrent(req, res);

    const { combatants } = res.json.mock.calls[0][0];
    expect(combatants[0]).toEqual({ id: 'cb1', name: 'Goblin', health: 7, initiative: 12, is_hidden: true, notes: 'weak', description: 'sneaky' });
  });

  it('redacts hidden combatants for players down to id/name/description/is_hidden', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignCharacterModel.isMember.mockResolvedValue(true);
    CombatSceneModel.findCurrentByCampaign.mockResolvedValue({ id: 's1', round_number: 2 });
    CombatantModel.listByScene.mockResolvedValue([
      { id: 'cb1', name: 'Goblin', health: 7, initiative: 12, notes: 'weak', description: 'sneaky', is_hidden: true, passive_defense: 12 },
      { id: 'cb2', name: 'Hero', health: 20, initiative: 18, is_hidden: false },
    ]);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'player-1' } });
    const res = mockRes();

    await CombatController.getCurrent(req, res);

    expect(res.json).toHaveBeenCalledWith({
      scene: { id: 's1', round_number: 2 },
      combatants: [
        { id: 'cb1', name: 'Goblin', description: 'sneaky', is_hidden: true },
        { id: 'cb2', name: 'Hero', health: 20, initiative: 18, is_hidden: false },
      ],
    });
  });
});

describe('CombatController.createScene', () => {
  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CombatController.createScene(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CombatSceneModel.create).not.toHaveBeenCalled();
  });

  it('creates the scene and responds 201', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.create.mockResolvedValue({ id: 's1', round_number: 1 });
    const req = mockReq({ params: { id: 'c1' }, body: { image_url: '/bg.jpg' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CombatController.createScene(req, res);

    expect(CombatSceneModel.create).toHaveBeenCalledWith('c1', { image_url: '/bg.jpg' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ scene: { id: 's1', round_number: 1 } });
  });
});

describe('CombatController.updateScene', () => {
  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1', sceneId: 's1' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CombatController.updateScene(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when the scene does not exist in this campaign', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', sceneId: 's1' }, user: { sub: 'gm-1' } });
    const res = mockRes();
    await CombatController.updateScene(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updates the scene', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.update.mockResolvedValue({ id: 's1', image_url: '/new.jpg' });
    const req = mockReq({ params: { id: 'c1', sceneId: 's1' }, body: { image_url: '/new.jpg' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CombatController.updateScene(req, res);

    expect(CombatSceneModel.update).toHaveBeenCalledWith('s1', 'c1', { image_url: '/new.jpg', round_number: undefined });
    expect(res.json).toHaveBeenCalledWith({ scene: { id: 's1', image_url: '/new.jpg' } });
  });
});

describe('CombatController.removeScene', () => {
  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1', sceneId: 's1' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CombatController.removeScene(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CombatSceneModel.remove).not.toHaveBeenCalled();
  });

  it('returns 404 when nothing matched', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.remove.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', sceneId: 's1' }, user: { sub: 'gm-1' } });
    const res = mockRes();
    await CombatController.removeScene(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('removes the scene and responds 204', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.remove.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', sceneId: 's1' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CombatController.removeScene(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});

describe('CombatController.addCombatant', () => {
  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1', sceneId: 's1' }, body: { name: 'Goblin' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CombatController.addCombatant(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CombatantModel.add).not.toHaveBeenCalled();
  });

  it('returns 404 when the scene does not exist in this campaign', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', sceneId: 'missing' }, body: { name: 'Goblin' }, user: { sub: 'gm-1' } });
    const res = mockRes();
    await CombatController.addCombatant(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(CombatantModel.add).not.toHaveBeenCalled();
  });

  it('returns 400 when name is missing or blank', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.findById.mockResolvedValue({ id: 's1' });
    const req = mockReq({ params: { id: 'c1', sceneId: 's1' }, body: { name: '  ' }, user: { sub: 'gm-1' } });
    const res = mockRes();
    await CombatController.addCombatant(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(CombatantModel.add).not.toHaveBeenCalled();
  });

  it('returns 404 when a given character_id does not exist', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.findById.mockResolvedValue({ id: 's1' });
    CampaignModel.findCharacterOwner.mockResolvedValue(null);
    const req = mockReq({
      params: { id: 'c1', sceneId: 's1' },
      body: { name: 'Hero', character_id: 'ch-missing' },
      user: { sub: 'gm-1' },
    });
    const res = mockRes();

    await CombatController.addCombatant(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(CombatantModel.add).not.toHaveBeenCalled();
  });

  it('creates a custom NPC combatant (no character_id) and responds 201', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.findById.mockResolvedValue({ id: 's1' });
    CombatantModel.add.mockResolvedValue({ id: 'cb1', name: 'Goblin' });
    const req = mockReq({
      params: { id: 'c1', sceneId: 's1' },
      body: { name: '  Goblin  ', health: 7 },
      user: { sub: 'gm-1' },
    });
    const res = mockRes();

    await CombatController.addCombatant(req, res);

    expect(CampaignModel.findCharacterOwner).not.toHaveBeenCalled();
    expect(CombatantModel.add).toHaveBeenCalledWith('s1', { name: 'Goblin', health: 7 });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ combatant: { id: 'cb1', name: 'Goblin' } });
  });

  it('creates a combatant linked to an existing character', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.findById.mockResolvedValue({ id: 's1' });
    CampaignModel.findCharacterOwner.mockResolvedValue({ id: 'ch1', user_id: 'player-1' });
    CombatantModel.add.mockResolvedValue({ id: 'cb1', name: 'Hero' });
    const req = mockReq({
      params: { id: 'c1', sceneId: 's1' },
      body: { name: 'Hero', character_id: 'ch1' },
      user: { sub: 'gm-1' },
    });
    const res = mockRes();

    await CombatController.addCombatant(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('CombatController.updateCombatant', () => {
  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1', combatantId: 'cb1' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CombatController.updateCombatant(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CombatantModel.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the combatant does not exist in this campaign', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatantModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', combatantId: 'cb1' }, body: { health: 3 }, user: { sub: 'gm-1' } });
    const res = mockRes();
    await CombatController.updateCombatant(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updates the combatant', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatantModel.update.mockResolvedValue({ id: 'cb1', health: 3 });
    const req = mockReq({ params: { id: 'c1', combatantId: 'cb1' }, body: { health: 3 }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CombatController.updateCombatant(req, res);

    expect(CombatantModel.update).toHaveBeenCalledWith('cb1', 'c1', { health: 3 });
    expect(res.json).toHaveBeenCalledWith({ combatant: { id: 'cb1', health: 3 } });
  });

  describe('player self-service (health/temp_hp/initiative/active_defense/passive_defense/notes on their own combatant)', () => {
    it('403s without even checking ownership when the body touches a non-self-service field', async () => {
      CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
      const req = mockReq({
        params: { id: 'c1', combatantId: 'cb1' },
        body: { health: 3, description: 'sneaky' },
        user: { sub: 'player-1' },
      });
      const res = mockRes();

      await CombatController.updateCombatant(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(CombatantModel.isOwnedByUser).not.toHaveBeenCalled();
      expect(CombatantModel.update).not.toHaveBeenCalled();
    });

    it('allows a player to patch passive_defense and notes on their own combatant', async () => {
      CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
      CombatantModel.isOwnedByUser.mockResolvedValue(true);
      CombatantModel.update.mockResolvedValue({ id: 'cb1', passive_defense: 14, notes: 'rolled physical dice' });
      const req = mockReq({
        params: { id: 'c1', combatantId: 'cb1' },
        body: { passive_defense: 14, notes: 'rolled physical dice' },
        user: { sub: 'player-1' },
      });
      const res = mockRes();

      await CombatController.updateCombatant(req, res);

      expect(CombatantModel.update).toHaveBeenCalledWith('cb1', 'c1', { passive_defense: 14, notes: 'rolled physical dice' });
      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    it('403s when the player does not own this combatant', async () => {
      CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
      CombatantModel.isOwnedByUser.mockResolvedValue(false);
      const req = mockReq({
        params: { id: 'c1', combatantId: 'cb1' },
        body: { health: 3 },
        user: { sub: 'player-1' },
      });
      const res = mockRes();

      await CombatController.updateCombatant(req, res);

      expect(CombatantModel.isOwnedByUser).toHaveBeenCalledWith('cb1', 'c1', 'player-1');
      expect(res.status).toHaveBeenCalledWith(403);
      expect(CombatantModel.update).not.toHaveBeenCalled();
    });

    it('allows a player to patch health/temp_hp on their own combatant', async () => {
      CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
      CombatantModel.isOwnedByUser.mockResolvedValue(true);
      CombatantModel.update.mockResolvedValue({ id: 'cb1', health: 12, temp_hp: 0 });
      const req = mockReq({
        params: { id: 'c1', combatantId: 'cb1' },
        body: { health: 12, temp_hp: 0 },
        user: { sub: 'player-1' },
      });
      const res = mockRes();

      await CombatController.updateCombatant(req, res);

      expect(CombatantModel.update).toHaveBeenCalledWith('cb1', 'c1', { health: 12, temp_hp: 0 });
      expect(res.json).toHaveBeenCalledWith({ combatant: { id: 'cb1', health: 12, temp_hp: 0 } });
    });

    it('allows a player to patch initiative/active_defense on their own combatant (dice roll result)', async () => {
      CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
      CombatantModel.isOwnedByUser.mockResolvedValue(true);
      CombatantModel.update.mockResolvedValue({ id: 'cb1', initiative: 4 });
      const req = mockReq({
        params: { id: 'c1', combatantId: 'cb1' },
        body: { initiative: 4 },
        user: { sub: 'player-1' },
      });
      const res = mockRes();

      await CombatController.updateCombatant(req, res);

      expect(CombatantModel.update).toHaveBeenCalledWith('cb1', 'c1', { initiative: 4 });
      expect(res.status).not.toHaveBeenCalledWith(403);
    });
  });
});

describe('CombatController.removeCombatant', () => {
  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1', combatantId: 'cb1' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CombatController.removeCombatant(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CombatantModel.remove).not.toHaveBeenCalled();
  });

  it('returns 404 when nothing matched', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatantModel.remove.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', combatantId: 'cb1' }, user: { sub: 'gm-1' } });
    const res = mockRes();
    await CombatController.removeCombatant(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('removes the combatant and responds 204', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatantModel.remove.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', combatantId: 'cb1' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CombatController.removeCombatant(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});

describe('CombatController.nextTurn', () => {
  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CombatController.nextTurn(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when there is no active scene', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.findCurrentByCampaign.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'gm-1' } });
    const res = mockRes();
    await CombatController.nextTurn(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 404 when everyone has already acted this round', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.findCurrentByCampaign.mockResolvedValue({ id: 's1' });
    CombatantModel.findNextToAct.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'gm-1' } });
    const res = mockRes();
    await CombatController.nextTurn(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(CombatantModel.markActed).not.toHaveBeenCalled();
  });

  it('marks the highest-initiative combatant as having acted', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.findCurrentByCampaign.mockResolvedValue({ id: 's1' });
    CombatantModel.findNextToAct.mockResolvedValue({ id: 'cb1', initiative: 18 });
    CombatantModel.markActed.mockResolvedValue({ id: 'cb1', initiative: 18, has_acted_this_round: true });
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CombatController.nextTurn(req, res);

    expect(CombatantModel.markActed).toHaveBeenCalledWith('cb1');
    expect(res.json).toHaveBeenCalledWith({ combatant: { id: 'cb1', initiative: 18, has_acted_this_round: true } });
  });
});

describe('CombatController.nextRound', () => {
  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CombatController.nextRound(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when there is no active scene', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.findCurrentByCampaign.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'gm-1' } });
    const res = mockRes();
    await CombatController.nextRound(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('advances the round and resets combatant turn flags', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CombatSceneModel.findCurrentByCampaign.mockResolvedValue({ id: 's1', round_number: 1 });
    CombatSceneModel.advanceRound.mockResolvedValue({ id: 's1', round_number: 2 });
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CombatController.nextRound(req, res);

    expect(CombatSceneModel.advanceRound).toHaveBeenCalledWith('s1', 'c1');
    expect(res.json).toHaveBeenCalledWith({ scene: { id: 's1', round_number: 2 } });
  });
});

describe('CombatController.syncHpFromCharacterSheet', () => {
  it('404s when the character does not exist', async () => {
    CampaignModel.findCharacterOwner.mockResolvedValue(null);
    const req = mockReq({ params: { characterId: 'ch1' }, body: { health: 10 }, user: { sub: 'player-1' } });
    const res = mockRes();

    await CombatController.syncHpFromCharacterSheet(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(CombatantModel.updateHpByCharacterId).not.toHaveBeenCalled();
  });

  it('403s when the requester does not own this character', async () => {
    CampaignModel.findCharacterOwner.mockResolvedValue({ id: 'ch1', user_id: 'someone-else' });
    const req = mockReq({ params: { characterId: 'ch1' }, body: { health: 10 }, user: { sub: 'player-1' } });
    const res = mockRes();

    await CombatController.syncHpFromCharacterSheet(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(CombatantModel.updateHpByCharacterId).not.toHaveBeenCalled();
  });

  it('updates every combatant linked to this character and returns them', async () => {
    CampaignModel.findCharacterOwner.mockResolvedValue({ id: 'ch1', user_id: 'player-1' });
    CombatantModel.updateHpByCharacterId.mockResolvedValue([{ id: 'cb1', health: 10, temp_hp: 2 }]);
    const req = mockReq({ params: { characterId: 'ch1' }, body: { health: 10, temp_hp: 2 }, user: { sub: 'player-1' } });
    const res = mockRes();

    await CombatController.syncHpFromCharacterSheet(req, res);

    expect(CombatantModel.updateHpByCharacterId).toHaveBeenCalledWith('ch1', { health: 10, temp_hp: 2 });
    expect(res.json).toHaveBeenCalledWith({ combatants: [{ id: 'cb1', health: 10, temp_hp: 2 }] });
  });
});
