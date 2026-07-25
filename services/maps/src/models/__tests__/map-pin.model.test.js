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
    expect(params).toEqual(['m1']);
  });
});

describe('MapPinModel.add', () => {
  it('inserts all six columns with concrete zoom values', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1' }] });
    await MapPinModel.add('m1', { locationId: 'loc1', x: 0.25, y: 0.75, minZoom: 1, maxZoom: 5 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO maps\.map_pins/);
    expect(params).toEqual(['m1', 'loc1', 0.25, 0.75, 1, 5]);
  });
});

describe('MapPinModel.update', () => {
  it('scopes the update by both pin id and map id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1' }] });
    await MapPinModel.update('p1', 'm1', { x: 0.1, y: 0.2, minZoom: 0, maxZoom: 100 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND map_id = \$2/);
    expect(params).toEqual(['p1', 'm1', 0.1, 0.2, 0, 100]);
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
