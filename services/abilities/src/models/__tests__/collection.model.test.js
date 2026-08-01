jest.mock('../../config/db');

const pool = require('../../config/db');
const CollectionModel = require('../collection.model');

beforeEach(() => {
  jest.resetAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('CollectionModel.findAll / findById items', () => {
  it('joins the union of abilities.entries and abilities.maneuvers, tagged by item_kind', async () => {
    await CollectionModel.findAll('u1', {});
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/'ability'::varchar AS type[\s\S]*FROM abilities\.entries/);
    expect(sql).toMatch(/'maneuver'::varchar[\s\S]*FROM abilities\.maneuvers/);
    expect(sql).toMatch(/JOIN \(/);
    expect(sql).toMatch(/i\.id = ci\.item_id AND i\.type = ci\.item_kind/);
  });

  it('projects both archetypes and duration_actions on collection items, whichever the kind has', async () => {
    await CollectionModel.findById('c1', 'u1');
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/'archetypes', i\.archetypes/);
    expect(sql).toMatch(/'duration_actions', i\.duration_actions/);
  });
});

describe('CollectionModel.addItem', () => {
  it('resolves the kind from whichever table the id lives in, then inserts with item_kind', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })   // owns the collection
      .mockResolvedValueOnce({ rows: [{ kind: 'maneuver' }] }) // findKindById (single UNION ALL query)
      .mockResolvedValueOnce({ rows: [{ collection_id: 'c1', item_id: 'm1', item_kind: 'maneuver' }] });

    const result = await CollectionModel.addItem('c1', 'u1', 'm1');

    expect(result).toEqual({ collection_id: 'c1', item_id: 'm1', item_kind: 'maneuver' });
    const insertCall = pool.query.mock.calls.find(([sql]) => /INSERT INTO abilities\.collection_items/.test(sql));
    expect(insertCall[0]).toMatch(/\(collection_id, item_id, item_kind\)/);
    expect(insertCall[1]).toEqual(['c1', 'm1', 'maneuver']);
  });

  it('returns null when the collection is not owned by the user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // owns check fails
    await expect(CollectionModel.addItem('c1', 'someone-else', 'a1')).resolves.toBeNull();
  });

  it('returns null when the id belongs to neither abilities.entries nor abilities.maneuvers', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // owns the collection
      .mockResolvedValueOnce({ rows: [] });                  // findKindById: not found in either
    await expect(CollectionModel.addItem('c1', 'u1', 'ghost')).resolves.toBeNull();
  });
});

describe('CollectionModel.removeItem', () => {
  it('deletes by the generic item_id column', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });
    await expect(CollectionModel.removeItem('c1', 'u1', 'm1')).resolves.toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ci\.item_id = \$3/);
    expect(params).toEqual(['c1', 'u1', 'm1', false]);
  });
});
