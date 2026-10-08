jest.mock('../../config/db');

const pool = require('../../config/db');
const BoardItemModel = require('../board-item.model');

let client;
beforeEach(() => {
  jest.clearAllMocks();
  client = { query: jest.fn(), release: jest.fn() };
  pool.connect.mockResolvedValue(client);
});

const clientSql = () => client.query.mock.calls.map(([sql]) => sql);

describe('BoardItemModel.listByZone', () => {
  it('filters to visible, openable rows for players and orders by position', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'b1' }] });

    const rows = await BoardItemModel.listByZone('c1', 'table', { manager: false, userId: 'u1', admin: false });

    expect(rows).toEqual([{ id: 'b1' }]);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/\$3::bool OR \(\s*b\.is_visible/);
    expect(sql).toMatch(/m\.is_public OR m\.created_by = \$4/);
    expect(sql).toMatch(/ORDER BY b\.position, b\.created_at/);
    expect(params).toEqual(['c1', 'table', false, 'u1', false]);
  });
});

describe('BoardItemModel.create', () => {
  it('inserts at the top of its zone inside a transaction', async () => {
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ position: -1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'b1' }] })
      .mockResolvedValueOnce({}); // COMMIT

    const item = await BoardItemModel.create('c1', { zone: 'table', kind: 'note', title: 'N' }, 'gm-1');

    expect(item).toEqual({ id: 'b1' });
    expect(clientSql()[0]).toBe('BEGIN');
    expect(clientSql()[3]).toBe('COMMIT');
    const insertParams = client.query.mock.calls[2][1];
    expect(insertParams[0]).toBe('c1');
    expect(insertParams[11]).toBe(-1);
    expect(clientSql().some((sql) => /campaign_maps/.test(sql))).toBe(false);
    expect(client.release).toHaveBeenCalled();
  });

  it('also links a map into campaign_maps for the maps service', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ position: 0 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'b1' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await BoardItemModel.create('c1', { zone: 'table', kind: 'map', ref_id: 'm1', title: 'M' }, 'gm-1');

    const [sql, params] = client.query.mock.calls[3];
    expect(sql).toMatch(/INSERT INTO campaigns\.campaign_maps/);
    expect(sql).toMatch(/ON CONFLICT \(campaign_id, map_id\) DO NOTHING/);
    expect(params).toEqual(['c1', 'm1', 'gm-1']);
  });

  it('rolls back on failure', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({});

    await expect(BoardItemModel.create('c1', { zone: 'table', kind: 'note', title: 'N' }, 'gm-1')).rejects.toThrow('boom');
    expect(clientSql()).toContain('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

describe('BoardItemModel.setFeatured', () => {
  it('clears the previous featured item first', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 'b2', is_featured: true }] })
      .mockResolvedValueOnce({});

    const item = await BoardItemModel.setFeatured('b2', 'c1', true);

    expect(item).toEqual({ id: 'b2', is_featured: true });
    expect(client.query.mock.calls[1][0]).toMatch(/SET is_featured = false/);
    expect(client.query.mock.calls[1][1]).toEqual(['c1', 'b2']);
  });

  it('does not touch other rows when unfeaturing', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 'b2', is_featured: false }] })
      .mockResolvedValueOnce({});

    await BoardItemModel.setFeatured('b2', 'c1', false);

    expect(clientSql().filter((sql) => /is_featured = false/.test(sql))).toHaveLength(0);
  });
});

describe('BoardItemModel.moveToZone', () => {
  it('lands hidden and unfeatured at the top of the new zone', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ position: -3 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'b1', zone: 'table' }] })
      .mockResolvedValueOnce({});

    await BoardItemModel.moveToZone('b1', 'c1', 'table');

    const [sql, params] = client.query.mock.calls[2];
    expect(sql).toMatch(/is_visible = false, is_featured = false/);
    expect(params).toEqual(['b1', 'c1', 'table', -3]);
  });
});

describe('BoardItemModel.reorder', () => {
  it('rewrites positions from the array order, scoped to campaign and zone', async () => {
    pool.query.mockResolvedValueOnce({});

    await BoardItemModel.reorder('c1', 'screen', ['a', 'b']);

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/unnest\(\$3::uuid\[\]\) WITH ORDINALITY/);
    expect(sql).toMatch(/b\.campaign_id = \$1 AND b\.zone = \$2/);
    expect(params).toEqual(['c1', 'screen', ['a', 'b']]);
  });
});

describe('BoardItemModel.updateFields', () => {
  it('updates only whitelisted provided fields', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'b1' }] });

    await BoardItemModel.updateFields('b1', 'c1', { title: 'T', content: undefined, zone: 'screen', is_visible: true });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/SET title = \$3, updated_at = NOW\(\)/);
    expect(sql).not.toMatch(/zone|is_visible/);
    expect(params).toEqual(['b1', 'c1', 'T']);
  });

  it('reads the row back when nothing changes', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'b1' }] });
    await BoardItemModel.updateFields('b1', 'c1', {});
    expect(pool.query.mock.calls[0][0]).toMatch(/^SELECT \* FROM campaigns\.campaign_board_items/);
  });
});

describe('BoardItemModel.remove', () => {
  it('unlinks a removed map from campaign_maps', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 'b1', kind: 'map', ref_id: 'm1', zone: 'table' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const removed = await BoardItemModel.remove('b1', 'c1');

    expect(removed.kind).toBe('map');
    expect(client.query.mock.calls[2][0]).toMatch(/DELETE FROM campaigns\.campaign_maps/);
    expect(client.query.mock.calls[2][1]).toEqual(['c1', 'm1']);
  });

  it('returns null when nothing matched', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});

    await expect(BoardItemModel.remove('zz', 'c1')).resolves.toBeNull();
  });
});
