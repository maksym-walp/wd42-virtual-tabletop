jest.mock('../../config/db');

const pool = require('../../config/db');
const { checkPrerequisites, isVisibleToUser } = require('../prerequisite.model');

beforeEach(() => {
  jest.clearAllMocks();
});

// checkPrerequisites query order:
//   1. SELECT prerequisite_node_ids, prerequisite_logic FROM <table>
//   2. SELECT node_id FROM skill_tree.node_grants ...   (gate links)
//   3. SELECT node_id FROM character_sheet.tree_progress ...  (only if any gate)
const noGrants = { rows: [] };

describe('checkPrerequisites', () => {
  it('is met with no missing nodes when the item has no prerequisites and no grant links', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ prerequisite_node_ids: null, prerequisite_logic: 'and' }] })
      .mockResolvedValueOnce(noGrants);

    const result = await checkPrerequisites('c1', 'abilities.entries', 'item1');

    expect(result).toEqual({ met: true, missing: [] });
    expect(pool.query).toHaveBeenCalledTimes(2); // tree_progress lookup skipped
  });

  it('is met with no missing nodes when the item has an empty prerequisite list', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ prerequisite_node_ids: [], prerequisite_logic: 'and' }] })
      .mockResolvedValueOnce(noGrants);

    const result = await checkPrerequisites('c1', 'abilities.entries', 'item1');

    expect(result).toEqual({ met: true, missing: [] });
  });

  it('is met when the item itself is not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await checkPrerequisites('c1', 'abilities.entries', 'missing-item');

    expect(result).toEqual({ met: true, missing: [] });
  });

  it("'and' logic requires every prerequisite node to be unlocked", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ prerequisite_node_ids: ['n1', 'n2'], prerequisite_logic: 'and' }] })
      .mockResolvedValueOnce(noGrants)
      .mockResolvedValueOnce({ rows: [{ node_id: 'n1' }] }); // only n1 unlocked

    const result = await checkPrerequisites('c1', 'abilities.entries', 'item1');

    expect(result.met).toBe(false);
    expect(result.missing).toEqual(['n2']);
  });

  it("'and' logic is met once all prerequisite nodes are unlocked", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ prerequisite_node_ids: ['n1', 'n2'], prerequisite_logic: 'and' }] })
      .mockResolvedValueOnce(noGrants)
      .mockResolvedValueOnce({ rows: [{ node_id: 'n1' }, { node_id: 'n2' }] });

    const result = await checkPrerequisites('c1', 'abilities.entries', 'item1');

    expect(result).toEqual({ met: true, missing: [] });
  });

  it("'or' logic is unmet when none of the prerequisite nodes are unlocked", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ prerequisite_node_ids: ['n1', 'n2'], prerequisite_logic: 'or' }] })
      .mockResolvedValueOnce(noGrants)
      .mockResolvedValueOnce({ rows: [] });

    const result = await checkPrerequisites('c1', 'abilities.entries', 'item1');

    expect(result.met).toBe(false);
    expect(result.missing).toEqual(['n1', 'n2']);
  });

  it("'or' logic is met once at least one prerequisite node is unlocked", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ prerequisite_node_ids: ['n1', 'n2'], prerequisite_logic: 'or' }] })
      .mockResolvedValueOnce(noGrants)
      .mockResolvedValueOnce({ rows: [{ node_id: 'n1' }] });

    const result = await checkPrerequisites('c1', 'abilities.entries', 'item1');

    expect(result.met).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('treats any logic value other than exactly "and" as OR semantics', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ prerequisite_node_ids: ['n1'], prerequisite_logic: null }] })
      .mockResolvedValueOnce(noGrants)
      .mockResolvedValueOnce({ rows: [{ node_id: 'n1' }] });

    const result = await checkPrerequisites('c1', 'abilities.entries', 'item1');

    expect(result.met).toBe(true);
  });

  it('a node_grants link alone gates an otherwise-free entry until its node is unlocked', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ prerequisite_node_ids: [], prerequisite_logic: 'or' }] })
      .mockResolvedValueOnce({ rows: [{ node_id: 'gate1' }] })
      .mockResolvedValueOnce({ rows: [] }); // gate1 not unlocked

    const result = await checkPrerequisites('c1', 'abilities.entries', 'item1');

    expect(result.met).toBe(false);
    expect(result.missing).toEqual(['gate1']);
  });

  it('a node_grants link is satisfied once its node is unlocked', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ prerequisite_node_ids: [], prerequisite_logic: 'or' }] })
      .mockResolvedValueOnce({ rows: [{ node_id: 'gate1' }] })
      .mockResolvedValueOnce({ rows: [{ node_id: 'gate1' }] });

    const result = await checkPrerequisites('c1', 'abilities.entries', 'item1');

    expect(result.met).toBe(true);
  });

  it('interpolates the fixed sourceTable literal into the SQL and passes itemId as the param', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ prerequisite_node_ids: null, prerequisite_logic: 'and' }] })
      .mockResolvedValueOnce(noGrants);

    await checkPrerequisites('c1', 'spellbook.spells', 'spell1');

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM spellbook\.spells/);
    expect(params).toEqual(['spell1']);
  });

  it('scopes the unlocked-nodes lookup to the character and the combined id list', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ prerequisite_node_ids: ['n1'], prerequisite_logic: 'and' }] })
      .mockResolvedValueOnce(noGrants)
      .mockResolvedValueOnce({ rows: [] });

    await checkPrerequisites('char-42', 'abilities.entries', 'item1');

    const [sql, params] = pool.query.mock.calls[2];
    expect(sql).toMatch(/character_sheet\.tree_progress/);
    expect(params).toEqual(['char-42', ['n1']]);
  });
});

describe('isVisibleToUser', () => {
  it('is true when a row matches (owned or public)', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

    const result = await isVisibleToUser('equipment.items', 'item1', 'u1');

    expect(result).toBe(true);
  });

  it('is false when no row matches (private and not owned)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await isVisibleToUser('equipment.items', 'item1', 'u1');

    expect(result).toBe(false);
  });

  it('interpolates the fixed sourceTable literal and passes itemId/userId as params', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await isVisibleToUser('abilities.maneuvers', 'maneuver1', 'user-9');

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM abilities\.maneuvers/);
    expect(sql).toMatch(/user_id = \$2/);
    expect(sql).toMatch(/is_public = true/);
    expect(params).toEqual(['maneuver1', 'user-9']);
  });
});
