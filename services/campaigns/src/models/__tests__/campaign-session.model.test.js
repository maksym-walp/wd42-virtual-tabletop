jest.mock('../../config/db');

const pool = require('../../config/db');
const CampaignSessionModel = require('../campaign-session.model');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CampaignSessionModel.listByCampaign', () => {
  it('returns the campaign sessions ordered by session_date then created_at', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 's1' }, { id: 's2' }] });
    const sessions = await CampaignSessionModel.listByCampaign('c1');
    expect(sessions).toEqual([{ id: 's1' }, { id: 's2' }]);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM campaigns\.campaign_sessions/);
    expect(sql).toMatch(/ORDER BY session_date NULLS LAST, created_at/);
    expect(params).toEqual(['c1']);
  });
});

describe('CampaignSessionModel.add', () => {
  it('inserts the session against the campaign and returns the row', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 's1', title: 'Session 1' }] });
    const session = await CampaignSessionModel.add('c1', { title: 'Session 1', content: 'They fought a dragon', session_date: '2024-01-01' });
    expect(session).toEqual({ id: 's1', title: 'Session 1' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO campaigns\.campaign_sessions/);
    expect(sql).toMatch(/RETURNING \*/);
    expect(params).toEqual(['c1', 'Session 1', 'They fought a dragon', '2024-01-01']);
  });

  it('defaults content and session_date to null when omitted', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 's1' }] });
    await CampaignSessionModel.add('c1', { title: 'Session 1' });
    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['c1', 'Session 1', null, null]);
  });
});

describe('CampaignSessionModel.update', () => {
  it('updates the session scoped by id and campaign_id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 's1', title: 'Updated' }] });
    const session = await CampaignSessionModel.update('s1', 'c1', { title: 'Updated', content: 'New recap', session_date: '2024-02-01' });
    expect(session).toEqual({ id: 's1', title: 'Updated' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND campaign_id = \$2/);
    expect(params).toEqual(['s1', 'c1', 'Updated', 'New recap', '2024-02-01']);
  });

  it('returns null when nothing matched', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await CampaignSessionModel.update('s1', 'other-campaign', { title: 'X' })).toBeNull();
  });
});

describe('CampaignSessionModel.remove', () => {
  it('scopes the delete by both session id and campaign id', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    expect(await CampaignSessionModel.remove('s1', 'c1')).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \$1 AND campaign_id = \$2/);
    expect(params).toEqual(['s1', 'c1']);
  });

  it('reports false when nothing matched', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    expect(await CampaignSessionModel.remove('s1', 'other-campaign')).toBe(false);
  });
});
