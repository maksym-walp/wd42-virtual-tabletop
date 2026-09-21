jest.mock('../../config/db');

const pool = require('../../config/db');
const CollectionModel = require('../collection.model');

beforeEach(() => {
  jest.resetAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('CollectionModel.findAll / findById items', () => {
  it('joins collection_items straight to abilities.entries via ability_id', async () => {
    await CollectionModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM abilities\.collection_items ci/);
    expect(sql).toMatch(/JOIN abilities\.entries a ON a\.id = ci\.ability_id/);
    expect(sql).not.toMatch(/abilities\.maneuvers/);
    expect(sql).not.toMatch(/item_kind/);
  });

  it('projects is_maneuver/duration_value/duration_unit on collection items', async () => {
    await CollectionModel.findById('c1', 'u1');
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/'archetypes', a\.archetypes/);
    expect(sql).toMatch(/'is_maneuver', a\.is_maneuver/);
    expect(sql).toMatch(/'duration_value', a\.duration_value/);
    expect(sql).toMatch(/'duration_unit', a\.duration_unit/);
  });
});

describe('CollectionModel.addItem', () => {
  it('checks the ability is visible, then inserts by ability_id', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })   // owns the collection
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })   // ability is visible
      .mockResolvedValueOnce({ rows: [{ collection_id: 'c1', ability_id: 'a1' }] });

    const result = await CollectionModel.addItem('c1', 'u1', 'a1');

    expect(result).toEqual({ collection_id: 'c1', ability_id: 'a1' });
    const visibleCall = pool.query.mock.calls.find(([sql]) => /FROM abilities\.entries/.test(sql));
    expect(visibleCall[0]).toMatch(/WHERE id = \$1 AND \(user_id = \$2 OR is_public = true OR \$3 = true\)/);
    const insertCall = pool.query.mock.calls.find(([sql]) => /INSERT INTO abilities\.collection_items/.test(sql));
    expect(insertCall[0]).toMatch(/\(collection_id, ability_id\)/);
    expect(insertCall[1]).toEqual(['c1', 'a1']);
  });

  it('returns null when the collection is not owned by the user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // owns check fails
    await expect(CollectionModel.addItem('c1', 'someone-else', 'a1')).resolves.toBeNull();
  });

  it('returns null when the ability is not visible to the user', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // owns the collection
      .mockResolvedValueOnce({ rows: [] });                  // ability not found/visible
    await expect(CollectionModel.addItem('c1', 'u1', 'ghost')).resolves.toBeNull();
  });
});

describe('CollectionModel.removeItem', () => {
  it('deletes by the ability_id column', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });
    await expect(CollectionModel.removeItem('c1', 'u1', 'a1')).resolves.toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ci\.ability_id = \$3/);
    expect(params).toEqual(['c1', 'u1', 'a1', false]);
  });
});
