jest.mock('../../config/db');

const pool = require('../../config/db');
const BoardSourceModel = require('../board-source.model');

const USER = { sub: 'u1', role: 'user' };

beforeEach(() => jest.clearAllMocks());

describe('BoardSourceModel.resolve', () => {
  it.each(['npc', 'creature', 'spell', 'ability', 'faction', 'map'])(
    '%s applies the owner/public/admin visibility rule', async (kind) => {
      pool.query.mockResolvedValueOnce({ rows: [{ title: 'X' }] });

      await expect(BoardSourceModel.resolve(kind, 'r1', null, USER)).resolves.toEqual({ title: 'X' });

      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).toMatch(/\$3::bool OR .*= \$2 OR .*is_public = true/);
      expect(params).toEqual(['r1', 'u1', false]);
    }
  );

  it('never reads NPC private notes into the snapshot', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await BoardSourceModel.resolve('npc', 'r1', null, USER);
    expect(pool.query.mock.calls[0][0]).not.toMatch(/private_notes/);
  });

  it('reads locations without a visibility gate and without the GM note', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ title: 'L' }] });
    await BoardSourceModel.resolve('location', 'r1', null, USER);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/gm_note/);
    expect(params).toEqual(['r1']);
  });

  it('picks the equipment table from the subtype', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await BoardSourceModel.resolve('equipment', 'r1', 'armor', { sub: 'a1', role: 'admin' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM equipment\.armor/);
    expect(params).toEqual(['r1', 'a1', true]);
  });

  it('returns null without querying for an unknown equipment subtype', async () => {
    await expect(BoardSourceModel.resolve('equipment', 'r1', 'items; DROP', USER)).resolves.toBeNull();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns null when the source is missing or hidden', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await expect(BoardSourceModel.resolve('spell', 'r1', null, USER)).resolves.toBeNull();
  });
});
