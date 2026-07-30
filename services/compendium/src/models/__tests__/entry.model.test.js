jest.mock('../../config/db');

const pool = require('../../config/db');
const EntryModel = require('../entry.model');

const ATTRS = { dexterity: 3, body: 4, intelligence: 2, wisdom: 5, charisma: 1 };

beforeEach(() => jest.clearAllMocks());

describe('EntryModel.create', () => {
  it('inserts an npc row with motivation/backstory/faction, joins health_die', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'e1' }] });
    await EntryModel.create({
      createdBy: 'u1', entityType: 'npc', name: 'Old Tom', speciesId: 's1', subspeciesId: 'sub1',
      description: 'd', history: null, imageUrl: '/img.png', motivation: 'gold', backstory: 'sailor', faction: 'Thieves Guild',
      attributes: ATTRS, isPublic: true,
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WITH inserted AS \(/);
    expect(sql).toMatch(/INSERT INTO compendium\.compendium_entries/);
    expect(sql).toMatch(/FROM inserted e/);
    expect(sql).toMatch(/LEFT JOIN compendium\.species sp ON sp\.id = e\.species_id/);
    expect(sql).toMatch(/LEFT JOIN compendium\.subspecies sub ON sub\.id = e\.subspecies_id/);
    expect(sql).toMatch(/COALESCE\(sub\.health_die, sp\.health_die, 'd6'\) AS health_die/);
    expect(params).toEqual([
      'npc', 'u1', 'Old Tom', 's1', 'sub1', 'd', null, '/img.png', 'gold', 'sailor', 'Thieves Guild',
      3, 4, 2, 5, 1, true,
    ]);
  });

  it('defaults optional fields to null / is_public false', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'e1' }] });
    await EntryModel.create({ createdBy: 'u1', entityType: 'creature', name: 'Wolf', attributes: ATTRS });
    expect(pool.query.mock.calls[0][1]).toEqual([
      'creature', 'u1', 'Wolf', null, null, null, null, null, null, null, null,
      3, 4, 2, 5, 1, false,
    ]);
  });
});

describe('EntryModel.findAll', () => {
  it('filters by own or public unless admin, joins health_die, no entity_type filter by default', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await EntryModel.findAll('u1', false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/e\.created_by = \$1 OR e\.is_public = true/);
    expect(sql).toMatch(/LEFT JOIN compendium\.species sp ON sp\.id = e\.species_id/);
    expect(sql).toMatch(/LEFT JOIN compendium\.subspecies sub ON sub\.id = e\.subspecies_id/);
    expect(sql).toMatch(/COALESCE\(sub\.health_die, sp\.health_die, 'd6'\) AS health_die/);
    expect(sql).not.toMatch(/entity_type = /);
    expect(params).toEqual(['u1', false]);
  });

  it('adds an entity_type filter when provided', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await EntryModel.findAll('u1', true, 'creature');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/e\.entity_type = \$3/);
    expect(params).toEqual(['u1', true, 'creature']);
  });
});

describe('EntryModel.findById', () => {
  it('computes is_owner against the given userId and joins health_die', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'e1' }] });
    await EntryModel.findById('e1', 'u1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/\(e\.created_by = \$2\) AS is_owner/);
    expect(sql).toMatch(/WHERE e\.id = \$1/);
    expect(sql).toMatch(/COALESCE\(sub\.health_die, sp\.health_die, 'd6'\) AS health_die/);
    expect(params).toEqual(['e1', 'u1']);
  });
});

describe('EntryModel.update', () => {
  it('updates mutable fields incl. faction, never entity_type, joins health_die', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'e1' }] });
    await EntryModel.update('e1', {
      name: 'New', speciesId: null, subspeciesId: null, description: null, history: null,
      imageUrl: null, motivation: null, backstory: null, faction: null, attributes: ATTRS, isPublic: false,
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WITH updated AS \(/);
    expect(sql).toMatch(/UPDATE compendium\.compendium_entries/);
    expect(sql).not.toMatch(/entity_type\s*=/);
    expect(sql).toMatch(/faction = \$10/);
    expect(sql).toMatch(/updated_at = NOW\(\)/);
    expect(sql).toMatch(/COALESCE\(sub\.health_die, sp\.health_die, 'd6'\) AS health_die/);
    expect(sql).not.toMatch(/rolled_health\s*=/); // a full-form edit never touches the persisted roll
    expect(params).toEqual(['e1', 'New', null, null, null, null, null, null, null, null, 3, 4, 2, 5, 1, false]);
  });
});

describe('EntryModel.updateRolledHealth', () => {
  it('sets rolled_health and nothing else, joins health_die', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'e1', rolled_health: 42 }] });
    const entry = await EntryModel.updateRolledHealth('e1', 42);
    expect(entry).toEqual({ id: 'e1', rolled_health: 42 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WITH updated AS \(/);
    expect(sql).toMatch(/SET rolled_health = \$2, updated_at = NOW\(\)/);
    expect(sql).toMatch(/WHERE id = \$1/);
    expect(sql).toMatch(/COALESCE\(sub\.health_die, sp\.health_die, 'd6'\) AS health_die/);
    expect(params).toEqual(['e1', 42]);
  });

  it('accepts null to clear a previously rolled value', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'e1', rolled_health: null }] });
    await EntryModel.updateRolledHealth('e1', null);
    expect(pool.query.mock.calls[0][1]).toEqual(['e1', null]);
  });

  it('returns null when the entry does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await EntryModel.updateRolledHealth('gone', 10)).toBeNull();
  });
});

describe('EntryModel.remove', () => {
  it('reports true/false from rowCount', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await EntryModel.remove('e1')).toBe(true);
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await EntryModel.remove('gone')).toBe(false);
  });
});
