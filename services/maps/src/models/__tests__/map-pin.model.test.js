jest.mock('../../config/db');

const pool = require('../../config/db');
const MapPinModel = require('../map-pin.model');

beforeEach(() => jest.clearAllMocks());

describe('MapPinModel.listByMap', () => {
  it('joins the location for labels but never selects gm_note', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1' }] });
    await MapPinModel.listByMap('m1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/JOIN maps\.locations/);
    expect(sql).not.toMatch(/gm_note/); // GM-only field must not leak to readers
    expect(sql).not.toMatch(/v\.description/); // per-version lore isn't needed to draw markers
    expect(sql).toMatch(/marker_icon/);
    expect(sql).toMatch(/marker_level/);
    expect(sql).toMatch(/location_versions/); // dated presentation overrides per pin
    expect(params).toEqual(['m1']);
  });
});

describe('MapPinModel.listVisibleToPlayer', () => {
  it('keeps pins with an empty visible_campaign_ids or a matching campaignId', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1' }] });
    await MapPinModel.listVisibleToPlayer('m1', 'camp-1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/JOIN maps\.locations/);
    expect(sql).toMatch(/array_length\(p\.visible_campaign_ids, 1\) IS NULL OR \$2::uuid = ANY\(p\.visible_campaign_ids\)/);
    expect(params).toEqual(['m1', 'camp-1']);
  });

  it('passes a null campaignId through as-is (only unrestricted pins match)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await MapPinModel.listVisibleToPlayer('m1', null);
    expect(pool.query.mock.calls[0][1]).toEqual(['m1', null]);
  });
});

describe('MapPinModel.add', () => {
  it('inserts lens_ids/visible_campaign_ids and start_year/end_year alongside the six original columns', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1' }] });
    await MapPinModel.add('m1', {
      locationId: 'loc1', x: 0.25, y: 0.75, minZoom: 1, maxZoom: 5,
      lensIds: ['lens-1'], visibleCampaignIds: [], startYear: 1200, endYear: null,
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO maps\.map_pins/);
    expect(sql).toMatch(/lens_ids, visible_campaign_ids, start_year, end_year/);
    expect(params).toEqual(['m1', 'loc1', 0.25, 0.75, 1, 5, ['lens-1'], [], 1200, null]);
  });
});

describe('MapPinModel.update', () => {
  it('scopes the update by both pin id and map id, including the array and year columns', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1' }] });
    await MapPinModel.update('p1', 'm1', {
      x: 0.1, y: 0.2, minZoom: 0, maxZoom: 100, lensIds: [], visibleCampaignIds: ['camp-1'],
      startYear: null, endYear: 1450,
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND map_id = \$2/);
    expect(sql).toMatch(/lens_ids = \$7::uuid\[\], visible_campaign_ids = \$8::uuid\[\]/);
    expect(sql).toMatch(/start_year = \$9, end_year = \$10/);
    expect(params).toEqual(['p1', 'm1', 0.1, 0.2, 0, 100, [], ['camp-1'], null, 1450]);
  });
});

describe('MapPinModel.remove', () => {
  it('scopes the delete by both pin id and map id', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await MapPinModel.remove('p1', 'm1')).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND map_id = \$2/);
    expect(params).toEqual(['p1', 'm1']);
  });
});
