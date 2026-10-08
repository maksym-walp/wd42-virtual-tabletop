jest.mock('../../models/campaign.model');
jest.mock('../../models/campaign-character.model');

const CampaignModel = require('../../models/campaign.model');
const CampaignCharacterModel = require('../../models/campaign-character.model');
const CampaignController = require('../campaign.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}

function mockReq({ body = {}, params = {}, user = { sub: 'user-1' } } = {}) {
  return { body, params, user };
}

beforeEach(() => jest.clearAllMocks());

describe('CampaignController.create', () => {
  it('returns 400 when name is missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await CampaignController.create(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(CampaignModel.create).not.toHaveBeenCalled();
  });

  it('creates a campaign and returns 201', async () => {
    CampaignModel.create.mockResolvedValue({ id: 'c1', name: 'Test' });
    const req = mockReq({ body: { name: 'Test' } });
    const res = mockRes();
    await CampaignController.create(req, res);
    expect(CampaignModel.create).toHaveBeenCalledWith('user-1', 'Test');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ campaign: { id: 'c1', name: 'Test' } });
  });

  it('rethrows unexpected model errors', async () => {
    const err = new Error('db down');
    CampaignModel.create.mockRejectedValue(err);
    const req = mockReq({ body: { name: 'Test' } });
    const res = mockRes();
    await expect(CampaignController.create(req, res)).rejects.toBe(err);
  });
});

describe('CampaignController.listMine', () => {
  it('strips gm_notes from campaigns the user is not GM of, keeps them where they are', async () => {
    CampaignModel.findAllForUser.mockResolvedValue([
      { id: 'c1', gm_id: 'user-1', gm_notes: 'secret GM stuff', is_gm: true },
      { id: 'c2', gm_id: 'gm-2', gm_notes: 'other GM secret', is_gm: false },
    ]);
    const req = mockReq();
    const res = mockRes();

    await CampaignController.listMine(req, res);

    const { campaigns } = res.json.mock.calls[0][0];
    const mine = campaigns.find((c) => c.id === 'c1');
    const notMine = campaigns.find((c) => c.id === 'c2');

    expect(mine.gm_notes).toBe('secret GM stuff');
    expect(notMine.gm_notes).toBeUndefined();
    expect('gm_notes' in notMine).toBe(false);
  });

  it('returns every campaign with GM access for an admin asking for scope=all', async () => {
    CampaignModel.findAll.mockResolvedValue([{ id: 'c9', gm_id: 'gm-9', gm_notes: 'n' }]);
    const req = { ...mockReq({ user: { sub: 'admin-1', role: 'admin' } }), query: { scope: 'all' } };
    const res = mockRes();

    await CampaignController.listMine(req, res);

    expect(CampaignModel.findAllForUser).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      campaigns: [{ id: 'c9', gm_id: 'gm-9', gm_notes: 'n', is_gm: true, access: 'admin' }],
    });
  });

  it('ignores scope=all for a non-admin', async () => {
    CampaignModel.findAllForUser.mockResolvedValue([]);
    const req = { ...mockReq(), query: { scope: 'all' } };

    await CampaignController.listMine(req, mockRes());

    expect(CampaignModel.findAll).not.toHaveBeenCalled();
    expect(CampaignModel.findAllForUser).toHaveBeenCalledWith('user-1');
  });
});

describe('CampaignController.getOne', () => {
  it('responds 404 when the campaign does not exist', async () => {
    CampaignModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();
    await CampaignController.getOne(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('lets the GM view the campaign including gm_notes', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'user-1', gm_notes: 'secret' });
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'user-1' } });
    const res = mockRes();

    await CampaignController.getOne(req, res);

    expect(CampaignCharacterModel.isMember).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      campaign: { id: 'c1', gm_id: 'user-1', gm_notes: 'secret', is_gm: true, access: 'gm' },
    });
  });

  it('lets a member view the campaign without gm_notes', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1', gm_notes: 'secret' });
    CampaignCharacterModel.isMember.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'member-1' } });
    const res = mockRes();

    await CampaignController.getOne(req, res);

    expect(CampaignCharacterModel.isMember).toHaveBeenCalledWith('c1', 'member-1');
    expect(res.json).toHaveBeenCalledWith({
      campaign: { id: 'c1', gm_id: 'gm-1', is_gm: false, access: 'player' },
    });
  });

  it('gives an admin who is not a member full GM access', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1', gm_notes: 'secret' });
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'admin-1', role: 'admin' } });
    const res = mockRes();

    await CampaignController.getOne(req, res);

    expect(CampaignCharacterModel.isMember).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      campaign: { id: 'c1', gm_id: 'gm-1', gm_notes: 'secret', is_gm: true, access: 'admin' },
    });
  });

  it('returns 403 when neither GM nor member', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1', gm_notes: 'secret' });
    CampaignCharacterModel.isMember.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'stranger-1' } });
    const res = mockRes();

    await CampaignController.getOne(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('CampaignController.updateGmNotes', () => {
  it('returns 404 when campaign is missing', async () => {
    CampaignModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();
    await CampaignController.updateGmNotes(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CampaignController.updateGmNotes(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CampaignModel.updateGmNotes).not.toHaveBeenCalled();
  });

  it('updates GM notes for the GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignModel.updateGmNotes.mockResolvedValue({ id: 'c1', gm_notes: 'plotting' });
    const req = mockReq({ params: { id: 'c1' }, body: { gm_notes: 'plotting' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignController.updateGmNotes(req, res);

    expect(CampaignModel.updateGmNotes).toHaveBeenCalledWith('c1', 'plotting');
    expect(res.json).toHaveBeenCalledWith({ campaign: { id: 'c1', gm_notes: 'plotting' } });
  });
});

describe('CampaignController.updateDescription', () => {
  it('returns 404 when campaign is missing', async () => {
    CampaignModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();
    await CampaignController.updateDescription(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CampaignController.updateDescription(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CampaignModel.updateDescription).not.toHaveBeenCalled();
  });

  it('updates description for the GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignModel.updateDescription.mockResolvedValue({ id: 'c1', description: 'Epic saga' });
    const req = mockReq({ params: { id: 'c1' }, body: { description: 'Epic saga' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignController.updateDescription(req, res);

    expect(CampaignModel.updateDescription).toHaveBeenCalledWith('c1', 'Epic saga');
    expect(res.json).toHaveBeenCalledWith({ campaign: { id: 'c1', description: 'Epic saga' } });
  });

  it('defaults description to empty string when not provided', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignModel.updateDescription.mockResolvedValue({ id: 'c1', description: '' });
    const req = mockReq({ params: { id: 'c1' }, body: {}, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignController.updateDescription(req, res);

    expect(CampaignModel.updateDescription).toHaveBeenCalledWith('c1', '');
  });
});

describe('CampaignController.updateCurrentDate', () => {
  it('returns 404 when campaign is missing', async () => {
    CampaignModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();
    await CampaignController.updateCurrentDate(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CampaignController.updateCurrentDate(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CampaignModel.updateCurrentDate).not.toHaveBeenCalled();
  });

  it('updates the current date for the GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignModel.updateCurrentDate.mockResolvedValue({ id: 'c1', current_year: 100 });
    const body = { calendar_id: 'cal-1', current_year: 100, current_month_id: 'm1', current_day: 5 };
    const req = mockReq({ params: { id: 'c1' }, body, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignController.updateCurrentDate(req, res);

    expect(CampaignModel.updateCurrentDate).toHaveBeenCalledWith('c1', body);
    expect(res.json).toHaveBeenCalledWith({ campaign: { id: 'c1', current_year: 100 } });
  });
});

describe('CampaignController.rename', () => {
  it('returns 404 when campaign is missing', async () => {
    CampaignModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' }, body: { name: 'New' } });
    const res = mockRes();
    await CampaignController.rename(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: 'New' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CampaignController.rename(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when name is missing or blank', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: '   ' }, user: { sub: 'gm-1' } });
    const res = mockRes();
    await CampaignController.rename(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(CampaignModel.rename).not.toHaveBeenCalled();
  });

  it('renames the campaign, trimming the name', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignModel.rename.mockResolvedValue({ id: 'c1', name: 'New Name' });
    const req = mockReq({ params: { id: 'c1' }, body: { name: '  New Name  ' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignController.rename(req, res);

    expect(CampaignModel.rename).toHaveBeenCalledWith('c1', 'New Name');
    expect(res.json).toHaveBeenCalledWith({ campaign: { id: 'c1', name: 'New Name' } });
  });
});

describe('CampaignController.remove', () => {
  it('returns 404 when campaign is missing', async () => {
    CampaignModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();
    await CampaignController.remove(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CampaignController.remove(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CampaignModel.remove).not.toHaveBeenCalled();
  });

  it('removes the campaign and responds 204', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignModel.remove.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignController.remove(req, res);

    expect(CampaignModel.remove).toHaveBeenCalledWith('c1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});

describe('CampaignController.regenerateInviteCode', () => {
  it('returns 403 for a player', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const res = mockRes();
    await CampaignController.regenerateInviteCode(mockReq({ params: { id: 'c1' }, user: { sub: 'p1' } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CampaignModel.regenerateInviteCode).not.toHaveBeenCalled();
  });

  it('issues a new code for the GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignModel.regenerateInviteCode.mockResolvedValue({ id: 'c1', invite_code: 'NEWCODE1' });
    const res = mockRes();
    await CampaignController.regenerateInviteCode(mockReq({ params: { id: 'c1' }, user: { sub: 'gm-1' } }), res);
    expect(CampaignModel.regenerateInviteCode).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ campaign: { id: 'c1', invite_code: 'NEWCODE1' } });
  });
});
