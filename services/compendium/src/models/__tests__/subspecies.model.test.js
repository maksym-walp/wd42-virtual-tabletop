jest.mock('../../config/db');

const pool = require('../../config/db');
const SubspeciesModel = require('../subspecies.model');

beforeEach(() => jest.clearAllMocks());

describe('SubspeciesModel.create', () => {
  it('inserts species_id, created_by + name/description/is_public/health_die', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'sub1' }] });
    await SubspeciesModel.create({ createdBy: 'u1', speciesId: 's1', name: 'Wood Elf', description: null, isPublic: false, healthDie: 'd8' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO compendium\.subspecies/);
    expect(params).toEqual(['s1', 'u1', 'Wood Elf', null, false, 'd8']);
  });

  it('defaults health_die to d6', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'sub1' }] });
    await SubspeciesModel.create({ createdBy: 'u1', speciesId: 's1', name: 'Wood Elf' });
    expect(pool.query.mock.calls[0][1]).toEqual(['s1', 'u1', 'Wood Elf', null, false, 'd6']);
  });
});

describe('SubspeciesModel.findAll', () => {
  it('filters by own or public unless admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await SubspeciesModel.findAll('u1', false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/created_by = \$1 OR is_public = true/);
    expect(sql).not.toMatch(/species_id = /);
    expect(params).toEqual(['u1', false]);
  });

  it('adds a species_id filter when provided', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await SubspeciesModel.findAll('u1', true, 's1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/species_id = \$3/);
    expect(params).toEqual(['u1', true, 's1']);
  });
});

describe('SubspeciesModel.findById', () => {
  it('computes is_owner against the given userId', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'sub1' }] });
    await SubspeciesModel.findById('sub1', 'u1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/\(created_by = \$2\) AS is_owner/);
    expect(sql).toMatch(/WHERE id = \$1/);
    expect(params).toEqual(['sub1', 'u1']);
  });
});

describe('SubspeciesModel.update', () => {
  it('updates mutable fields, health_die and updated_at', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'sub1' }] });
    await SubspeciesModel.update('sub1', { name: 'New', description: 'd', isPublic: true, healthDie: 'd12' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE compendium\.subspecies/);
    expect(sql).toMatch(/health_die = \$5/);
    expect(sql).toMatch(/updated_at = NOW\(\)/);
    expect(params).toEqual(['sub1', 'New', 'd', true, 'd12']);
  });
});

describe('SubspeciesModel.remove', () => {
  it('reports true/false from rowCount', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await SubspeciesModel.remove('sub1')).toBe(true);
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await SubspeciesModel.remove('gone')).toBe(false);
  });
});
