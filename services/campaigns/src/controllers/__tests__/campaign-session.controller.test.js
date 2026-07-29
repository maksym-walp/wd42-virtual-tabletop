jest.mock('../../models/campaign.model');
jest.mock('../../models/campaign-character.model');
jest.mock('../../models/campaign-session.model');

const CampaignModel = require('../../models/campaign.model');
const CampaignCharacterModel = require('../../models/campaign-character.model');
const CampaignSessionModel = require('../../models/campaign-session.model');
const CampaignSessionController = require('../campaign-session.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}

function mockReq({ body = {}, params = {}, user = { sub: 'user-1' } } = {}) {
  return { body, params, user };
}

beforeEach(() => jest.clearAllMocks());

describe('CampaignSessionController.list', () => {
  it('returns 404 when campaign is missing', async () => {
    CampaignModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();
    await CampaignSessionController.list(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when requester is neither GM nor member', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignCharacterModel.isMember.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'stranger' } });
    const res = mockRes();
    await CampaignSessionController.list(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CampaignSessionModel.listByCampaign).not.toHaveBeenCalled();
  });

  it('lists sessions for a member', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignCharacterModel.isMember.mockResolvedValue(true);
    CampaignSessionModel.listByCampaign.mockResolvedValue([{ id: 's1' }]);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'member-1' } });
    const res = mockRes();

    await CampaignSessionController.list(req, res);

    expect(res.json).toHaveBeenCalledWith({ sessions: [{ id: 's1' }] });
  });
});

describe('CampaignSessionController.add', () => {
  it('returns 404 when campaign is missing', async () => {
    CampaignModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();
    await CampaignSessionController.add(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1' }, body: { title: 'Session 1' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CampaignSessionController.add(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CampaignSessionModel.add).not.toHaveBeenCalled();
  });

  it('returns 400 when title is missing or blank', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1' }, body: { title: '   ' }, user: { sub: 'gm-1' } });
    const res = mockRes();
    await CampaignSessionController.add(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(CampaignSessionModel.add).not.toHaveBeenCalled();
  });

  it('creates the session and responds 201', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignSessionModel.add.mockResolvedValue({ id: 's1', title: 'Session 1' });
    const req = mockReq({
      params: { id: 'c1' },
      body: { title: '  Session 1  ', content: 'Recap', session_date: '2024-01-01' },
      user: { sub: 'gm-1' },
    });
    const res = mockRes();

    await CampaignSessionController.add(req, res);

    expect(CampaignSessionModel.add).toHaveBeenCalledWith('c1', { title: 'Session 1', content: 'Recap', session_date: '2024-01-01' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ session: { id: 's1', title: 'Session 1' } });
  });
});

describe('CampaignSessionController.update', () => {
  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1', sessionId: 's1' }, body: { title: 'X' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CampaignSessionController.update(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CampaignSessionModel.update).not.toHaveBeenCalled();
  });

  it('returns 400 when title is missing or blank', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1', sessionId: 's1' }, body: { title: '' }, user: { sub: 'gm-1' } });
    const res = mockRes();
    await CampaignSessionController.update(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when the session does not exist in this campaign', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignSessionModel.update.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', sessionId: 's1' }, body: { title: 'X' }, user: { sub: 'gm-1' } });
    const res = mockRes();
    await CampaignSessionController.update(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updates the session and returns it', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignSessionModel.update.mockResolvedValue({ id: 's1', title: 'Updated' });
    const req = mockReq({ params: { id: 'c1', sessionId: 's1' }, body: { title: 'Updated' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignSessionController.update(req, res);

    expect(CampaignSessionModel.update).toHaveBeenCalledWith('s1', 'c1', { title: 'Updated', content: undefined, session_date: undefined });
    expect(res.json).toHaveBeenCalledWith({ session: { id: 's1', title: 'Updated' } });
  });
});

describe('CampaignSessionController.remove', () => {
  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1', sessionId: 's1' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CampaignSessionController.remove(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CampaignSessionModel.remove).not.toHaveBeenCalled();
  });

  it('returns 404 when the session does not exist', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignSessionModel.remove.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', sessionId: 's1' }, user: { sub: 'gm-1' } });
    const res = mockRes();
    await CampaignSessionController.remove(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('removes the session and responds 204', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignSessionModel.remove.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', sessionId: 's1' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignSessionController.remove(req, res);

    expect(CampaignSessionModel.remove).toHaveBeenCalledWith('s1', 'c1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});
