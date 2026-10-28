const CharacterSheetClient = require('../character-sheet.client');

const ok = (data) => ({ ok: true, status: 200, json: async () => data });

beforeEach(() => {
  global.fetch = jest.fn();
  process.env.CHARACTER_SHEET_URL = 'http://cs:3005/';
});

describe('CharacterSheetClient.advanceTimer', () => {
  it('posts to /timer/advance forwarding Authorization', async () => {
    fetch.mockResolvedValue(ok({ results: [] }));

    const data = await CharacterSheetClient.advanceTimer('Bearer t', { characterIds: ['a'], hours: 4, sourceKey: 'combat:s1' });

    expect(data).toEqual({ results: [] });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://cs:3005/timer/advance');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer t');
    expect(JSON.parse(options.body)).toEqual({ character_ids: ['a'], hours: 4, source_key: 'combat:s1' });
    expect(options.signal).toBeDefined();
  });

  it('turns a network failure or timeout into 502', async () => {
    fetch.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(CharacterSheetClient.advanceTimer('Bearer t', { characterIds: ['a'], hours: 1 }))
      .rejects.toMatchObject({ statusCode: 502 });
  });

  it('turns a 5xx into 502 and passes 4xx through with the message', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ message: 'x' }) });
    await expect(CharacterSheetClient.advanceTimer('t', { characterIds: ['a'], hours: 1 })).rejects.toMatchObject({ statusCode: 502 });

    fetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ message: 'Заборонено' }) });
    await expect(CharacterSheetClient.advanceTimer('t', { characterIds: ['a'], hours: 1 }))
      .rejects.toMatchObject({ statusCode: 403, message: 'Заборонено' });
  });
});
