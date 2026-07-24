jest.mock('../../config/db');

const pool = require('../../config/db');
const TraditionModel = require('../tradition.model');

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('TraditionModel.findAll', () => {
  it('has no top-level WHERE clause when no search is given', async () => {
    await TraditionModel.findAll({});
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/traditions t\s+WHERE/);
    expect(sql).toMatch(/ORDER BY t\.name ASC/);
    expect(params).toEqual([]);
  });

  it('adds a parameterized ILIKE condition when search is given', async () => {
    await TraditionModel.findAll({ search: 'fire' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/traditions t\s+WHERE t\.name ILIKE \$1/);
    expect(params).toEqual(['%fire%']);
  });
});

describe('TraditionModel.findById', () => {
  it('queries by id', async () => {
    await TraditionModel.findById('t1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE t\.id = \$1/);
    expect(params).toEqual(['t1']);
  });

  it('returns null when not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const result = await TraditionModel.findById('missing');
    expect(result).toBeNull();
  });
});

describe('TraditionModel.create', () => {
  it('inserts with creator_id set from userId', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 't1' }] });
    const result = await TraditionModel.create('user-1', { name: 'Arcane Circle', description: 'desc', founders: 'Someone' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO spellbook\.traditions/);
    expect(params).toEqual(['Arcane Circle', 'desc', 'Someone', 'user-1']);
    expect(result).toEqual({ id: 't1' });
  });

  it('defaults optional fields to null', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 't1' }] });
    await TraditionModel.create('user-1', { name: 'Solo Tradition' });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['Solo Tradition', null, null, 'user-1']);
  });
});

describe('TraditionModel.update', () => {
  it('updates without any ownership check', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 't1' }] });
    const result = await TraditionModel.update('t1', { name: 'New name', description: null, founders: null });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE spellbook\.traditions/);
    expect(sql).not.toMatch(/user_id/);
    expect(params).toEqual(['t1', 'New name', null, null]);
    expect(result).toEqual({ id: 't1' });
  });

  it('returns null when the tradition does not exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const result = await TraditionModel.update('missing', { name: 'X' });
    expect(result).toBeNull();
  });
});

describe('TraditionModel.delete', () => {
  it('returns true when a row was deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });
    await expect(TraditionModel.delete('t1')).resolves.toBe(true);
  });

  it('returns false when no row was deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 0 });
    await expect(TraditionModel.delete('missing')).resolves.toBe(false);
  });
});

describe('TraditionModel.addSpell', () => {
  it('returns null when the caller does not own the spell', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const result = await TraditionModel.addSpell('t1', 'user-1', 's1', false);
    expect(result).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND user_id = \$2/);
    expect(params).toEqual(['s1', 'user-1']);
  });

  it('skips the ownership filter for admins', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    pool.query.mockResolvedValueOnce({ rows: [{ tradition_id: 't1', spell_id: 's1' }] });
    await TraditionModel.addSpell('t1', 'user-1', 's1', true);
    const [ownerSql] = pool.query.mock.calls[0];
    expect(ownerSql).toMatch(/WHERE id = \$1 AND TRUE/);
  });

  it('inserts into the join table when the caller owns the spell', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    pool.query.mockResolvedValueOnce({ rows: [{ tradition_id: 't1', spell_id: 's1' }] });
    const result = await TraditionModel.addSpell('t1', 'user-1', 's1', false);
    const [insertSql, insertParams] = pool.query.mock.calls[1];
    expect(insertSql).toMatch(/INSERT INTO spellbook\.tradition_spells/);
    expect(insertSql).toMatch(/ON CONFLICT \(tradition_id, spell_id\) DO NOTHING/);
    expect(insertParams).toEqual(['t1', 's1']);
    expect(result).toEqual({ tradition_id: 't1', spell_id: 's1' });
  });
});

describe('TraditionModel.removeSpell', () => {
  it('returns true when a row was deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });
    const result = await TraditionModel.removeSpell('t1', 'user-1', 's1', false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM spellbook\.tradition_spells/);
    expect(sql).toMatch(/s\.user_id = \$2/);
    expect(params).toEqual(['t1', 'user-1', 's1']);
    expect(result).toBe(true);
  });

  it('bypasses ownership for admins', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });
    await TraditionModel.removeSpell('t1', 'user-1', 's1', true);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/AND TRUE AND/);
  });

  it('returns false when no row was deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 0 });
    await expect(TraditionModel.removeSpell('t1', 'user-1', 's1', false)).resolves.toBe(false);
  });
});
