jest.mock('../../models/campaign.model');
jest.mock('../../models/campaign-character.model');
jest.mock('../../models/campaign-gallery.model');

const CampaignModel = require('../../models/campaign.model');
const CampaignCharacterModel = require('../../models/campaign-character.model');
const CampaignGalleryModel = require('../../models/campaign-gallery.model');
const CampaignGalleryController = require('../campaign-gallery.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}

function mockReq({ body = {}, params = {}, user = { sub: 'user-1' } } = {}) {
  return { body, params, user };
}

beforeEach(() => jest.clearAllMocks());

describe('CampaignGalleryController.list', () => {
  it('returns 404 when campaign is missing', async () => {
    CampaignModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();
    await CampaignGalleryController.list(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when requester is neither GM nor member', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignCharacterModel.isMember.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'stranger' } });
    const res = mockRes();
    await CampaignGalleryController.list(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CampaignGalleryModel.listByCampaign).not.toHaveBeenCalled();
  });

  it('lists images for the GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignGalleryModel.listByCampaign.mockResolvedValue([{ id: 'img-1' }]);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignGalleryController.list(req, res);

    expect(CampaignCharacterModel.isMember).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ images: [{ id: 'img-1' }] });
  });

  it('lists images for a member', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignCharacterModel.isMember.mockResolvedValue(true);
    CampaignGalleryModel.listByCampaign.mockResolvedValue([{ id: 'img-1' }]);
    const req = mockReq({ params: { id: 'c1' }, user: { sub: 'member-1' } });
    const res = mockRes();

    await CampaignGalleryController.list(req, res);

    expect(res.json).toHaveBeenCalledWith({ images: [{ id: 'img-1' }] });
  });
});

describe('CampaignGalleryController.add', () => {
  beforeEach(() => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
  });

  it('returns 404 when campaign is missing', async () => {
    CampaignModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();
    await CampaignGalleryController.add(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when requester is not GM', async () => {
    const req = mockReq({ params: { id: 'c1' }, body: { image_url: 'https://x.com/a.jpg' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CampaignGalleryController.add(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CampaignGalleryModel.add).not.toHaveBeenCalled();
  });

  it.each([
    ['a /uploads/ path', '/uploads/campaigns/c1/gallery/x.jpg'],
    ['an https:// url', 'https://cdn.example.com/img.jpg'],
  ])('accepts %s', async (_name, url) => {
    CampaignGalleryModel.add.mockResolvedValue({ id: 'img-1', image_url: url });
    const req = mockReq({ params: { id: 'c1' }, body: { image_url: url }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignGalleryController.add(req, res);

    expect(CampaignGalleryModel.add).toHaveBeenCalledWith('c1', url);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ image: { id: 'img-1', image_url: url } });
  });

  it.each([
    ['javascript: scheme', 'javascript:alert(1)'],
    ['data: scheme', 'data:image/png;base64,AAAA'],
    ['http:// (not https)', 'http://cdn.example.com/img.jpg'],
    ['a relative path outside /uploads/', '/etc/passwd'],
    ['an overlong url', `https://example.com/${'a'.repeat(500)}.jpg`],
    ['a non-string value', 12345],
    ['an empty string', ''],
    ['undefined', undefined],
  ])('rejects %s with 400', async (_name, url) => {
    const req = mockReq({ params: { id: 'c1' }, body: { image_url: url }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignGalleryController.add(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(CampaignGalleryModel.add).not.toHaveBeenCalled();
  });

  it('accepts a url right at the max length boundary', async () => {
    const prefix = 'https://example.com/';
    const url = prefix + 'a'.repeat(500 - prefix.length); // total length exactly 500
    expect(url.length).toBe(500);
    CampaignGalleryModel.add.mockResolvedValue({ id: 'img-1', image_url: url });
    const req = mockReq({ params: { id: 'c1' }, body: { image_url: url }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignGalleryController.add(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('CampaignGalleryController.remove', () => {
  it('returns 404 when campaign is missing', async () => {
    CampaignModel.findById.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing', imageId: 'img-1' } });
    const res = mockRes();
    await CampaignGalleryController.remove(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when requester is not GM', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    const req = mockReq({ params: { id: 'c1', imageId: 'img-1' }, user: { sub: 'not-gm' } });
    const res = mockRes();
    await CampaignGalleryController.remove(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(CampaignGalleryModel.remove).not.toHaveBeenCalled();
  });

  it('returns 404 when the image does not exist in this campaign', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignGalleryModel.remove.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', imageId: 'img-1' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignGalleryController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('removes the image and responds 204', async () => {
    CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
    CampaignGalleryModel.remove.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', imageId: 'img-1' }, user: { sub: 'gm-1' } });
    const res = mockRes();

    await CampaignGalleryController.remove(req, res);

    expect(CampaignGalleryModel.remove).toHaveBeenCalledWith('img-1', 'c1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});
