jest.mock('../../config/db');

const pool = require('../../config/db');
const SpeciesModel = require('../species.model');

beforeEach(() => jest.clearAllMocks());

describe('SpeciesModel.create', () => {
  it('inserts created_by + name/description/is_public/health_die', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 's1' }] });
    await SpeciesModel.create({ createdBy: 'u1', name: 'Elf', description: 'Long-lived', isPublic: true, healthDie: 'd8' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO compendium\.species/);
    expect(params).toEqual(['u1', 'Elf', 'Long-lived', true, 'd8']);
  });

  it('defaults description to null, is_public to false, health_die to d6', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 's1' }] });
    await SpeciesModel.create({ createdBy: 'u1', name: 'Elf' });
    expect(pool.query.mock.calls[0][1]).toEqual(['u1', 'Elf', null, false, 'd6']);
  });
});

describe('SpeciesModel.findAll', () => {
  it('filters by own or public unless admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await SpeciesModel.findAll('u1', false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/created_by = \$1 OR is_public = true/);
    expect(params).toEqual(['u1', false]);
  });
});

describe('SpeciesModel.findById', () => {
  it('computes is_owner against the given userId', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 's1' }] });
    await SpeciesModel.findById('s1', 'u1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/\(created_by = \$2\) AS is_owner/);
    expect(sql).toMatch(/WHERE id = \$1/);
    expect(params).toEqual(['s1', 'u1']);
  });
});

describe('SpeciesModel.update', () => {
  it('updates mutable fields, health_die and updated_at', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 's1' }] });
    await SpeciesModel.update('s1', { name: 'New', description: null, isPublic: true, healthDie: 'd10' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE compendium\.species/);
    expect(sql).toMatch(/health_die = \$5/);
    expect(sql).toMatch(/updated_at = NOW\(\)/);
    expect(params).toEqual(['s1', 'New', null, true, 'd10']);
  });
});

describe('SpeciesModel.remove', () => {
  it('reports true/false from rowCount', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await SpeciesModel.remove('s1')).toBe(true);
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await SpeciesModel.remove('gone')).toBe(false);
  });
});
