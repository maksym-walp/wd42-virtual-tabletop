jest.mock('../../config/db');

const pool = require('../../config/db');
const RitualTrackerModel = require('../ritual-tracker.model');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RitualTrackerModel.findAll', () => {
  it('returns all trackers for the character', async () => {
    const rows = [{ id: 't1' }, { id: 't2' }];
    pool.query.mockResolvedValue({ rows });

    const result = await RitualTrackerModel.findAll('c1');

    expect(result).toBe(rows);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/character_sheet\.ritual_trackers/);
    expect(params).toEqual(['c1']);
  });
});

describe('RitualTrackerModel.create', () => {
  it('defaults rounds to 3 and participants to [] when omitted, JSON-stringified', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 't1' }] });

    await RitualTrackerModel.create('c1', { name: 'Summon' });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO character_sheet\.ritual_trackers/);
    expect(params).toEqual(['c1', 'Summon', 3, '[]']);
  });

  it('uses provided rounds/participants, JSON-stringifying participants', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 't1' }] });
    const participants = [{ name: 'Bob', successes: [true, false] }];

    await RitualTrackerModel.create('c1', { name: 'Summon', rounds: 5, participants });

    const params = pool.query.mock.calls[0][1];
    expect(params).toEqual(['c1', 'Summon', 5, JSON.stringify(participants)]);
  });

  it('returns the created row', async () => {
    const row = { id: 't1', name: 'Summon' };
    pool.query.mockResolvedValue({ rows: [row] });

    const result = await RitualTrackerModel.create('c1', { name: 'Summon' });

    expect(result).toBe(row);
  });
});

describe('RitualTrackerModel.update', () => {
  it('passes null for name/rounds and null for participants when only some fields are given (COALESCE partial update)', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 't1' }] });

    await RitualTrackerModel.update('c1', 't1', { name: 'New name' });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE character_sheet\.ritual_trackers/);
    expect(sql).toMatch(/COALESCE/);
    expect(params).toEqual(['t1', 'c1', 'New name', null, null]);
  });

  it('only JSON-stringifies participants when explicitly provided', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 't1' }] });
    const participants = [{ name: 'Bob', successes: [true] }];

    await RitualTrackerModel.update('c1', 't1', { participants });

    const params = pool.query.mock.calls[0][1];
    expect(params).toEqual(['t1', 'c1', null, null, JSON.stringify(participants)]);
  });

  it('leaves participants as null (not "undefined") when omitted entirely', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 't1' }] });

    await RitualTrackerModel.update('c1', 't1', { rounds: 4 });

    const params = pool.query.mock.calls[0][1];
    expect(params).toEqual(['t1', 'c1', null, 4, null]);
  });

  it('returns null when no row matched', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await RitualTrackerModel.update('c1', 'missing', { name: 'x' });

    expect(result).toBeNull();
  });
});

describe('RitualTrackerModel.delete', () => {
  it('returns true when a row was deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });

    const result = await RitualTrackerModel.delete('c1', 't1');

    expect(result).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM character_sheet\.ritual_trackers/);
    expect(params).toEqual(['t1', 'c1']);
  });

  it('returns false when nothing was deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 0 });

    const result = await RitualTrackerModel.delete('c1', 'missing');

    expect(result).toBe(false);
  });
});
