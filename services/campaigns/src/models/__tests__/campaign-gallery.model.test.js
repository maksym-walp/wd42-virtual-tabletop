jest.mock('../../config/db');

const pool = require('../../config/db');
const CampaignGalleryModel = require('../campaign-gallery.model');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CampaignGalleryModel.listByCampaign', () => {
  it('returns the campaign images newest first', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'i2' }, { id: 'i1' }] });
    const images = await CampaignGalleryModel.listByCampaign('c1');
    expect(images).toEqual([{ id: 'i2' }, { id: 'i1' }]);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM campaigns\.campaign_gallery/);
    expect(sql).toMatch(/ORDER BY created_at DESC/);
    expect(params).toEqual(['c1']);
  });
});

describe('CampaignGalleryModel.add', () => {
  it('inserts the url against the campaign and returns the row', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'i1', image_url: '/uploads/campaigns/c1/gallery/x.png' }] });
    const image = await CampaignGalleryModel.add('c1', '/uploads/campaigns/c1/gallery/x.png');
    expect(image.id).toBe('i1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO campaigns\.campaign_gallery/);
    expect(sql).toMatch(/RETURNING \*/);
    expect(params).toEqual(['c1', '/uploads/campaigns/c1/gallery/x.png']);
  });
});

describe('CampaignGalleryModel.remove', () => {
  // Scoping the DELETE by campaign as well as by image id is what stops a
  // guessed image id from deleting another campaign's row.
  it('scopes the delete by both image id and campaign id', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await CampaignGalleryModel.remove('i1', 'c1')).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND campaign_id = \$2/);
    expect(params).toEqual(['i1', 'c1']);
  });

  it('reports false when nothing matched', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await CampaignGalleryModel.remove('i1', 'other-campaign')).toBe(false);
  });
});
