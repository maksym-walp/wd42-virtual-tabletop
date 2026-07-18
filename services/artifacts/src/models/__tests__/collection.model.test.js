jest.mock('../../config/db');

const pool = require('../../config/db');
const CollectionModel = require('../collection.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('CollectionModel.addItem guards', () => {
  it('refuses when the caller does not own the collection', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // ownership check
    const added = await CollectionModel.addItem('c1', 'u1', 'a1');
    expect(added).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('refuses when the artifact is neither owned nor public', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // owns collection
      .mockResolvedValueOnce({ rows: [] });                 // artifact not visible
    const added = await CollectionModel.addItem('c1', 'u1', 'a1');
    expect(added).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('returns the membership even when the insert is a no-op duplicate', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [] }); // ON CONFLICT DO NOTHING
    const added = await CollectionModel.addItem('c1', 'u1', 'a1');
    expect(added).toEqual({ collection_id: 'c1', artifact_id: 'a1' });
  });
});

describe('CollectionModel visibility', () => {
  it('findPublicById only matches public collections and never claims ownership', async () => {
    await CollectionModel.findPublicById('c1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/false AS is_owner/);
    expect(sql).toMatch(/c\.is_public = true/);
    expect(params).toEqual(['c1']);
  });

  it('aggregates member artifacts from artifacts.collection_items', async () => {
    await CollectionModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM artifacts\.collection_items ci/);
    expect(sql).toMatch(/JOIN artifacts\.entries a ON a\.id = ci\.artifact_id/);
  });

  it('restricts to admin-authored collections when scope=canonical', async () => {
    await CollectionModel.findAll('u1', { scope: 'canonical' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/AND cu\.role = 'admin'/);
  });
});
