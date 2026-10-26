jest.mock('../../models/config.model');

const ConfigModel = require('../../models/config.model');
const ConfigController = require('../config.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}
function mockReq({ body = {}, params = {}, query = {} } = {}) {
  return { body, params, query };
}

const weaponTypes = { key: 'weapon_types', value: [{ key: 'melee', label: 'Ближня' }] };

beforeEach(() => jest.clearAllMocks());

describe('ConfigController.list', () => {
  it('200 with all configs', async () => {
    ConfigModel.findAll.mockResolvedValue([weaponTypes]);
    const res = mockRes();
    await ConfigController.list(mockReq(), res);
    expect(res.json).toHaveBeenCalledWith({ configs: [weaponTypes] });
  });
});

describe('ConfigController.getOne', () => {
  it('404 when missing', async () => {
    ConfigModel.findByKey.mockResolvedValue(null);
    const res = mockRes();
    await ConfigController.getOne(mockReq({ params: { key: 'weapon_types' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('200 when found', async () => {
    ConfigModel.findByKey.mockResolvedValue(weaponTypes);
    const res = mockRes();
    await ConfigController.getOne(mockReq({ params: { key: 'weapon_types' } }), res);
    expect(res.json).toHaveBeenCalledWith({ config: weaponTypes });
  });
});

describe('ConfigController.update', () => {
  it('404 for a key outside the allowed set', async () => {
    const res = mockRes();
    await ConfigController.update(mockReq({ params: { key: 'unknown' }, body: { value: [{ key: 'a', label: 'A' }] } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(ConfigModel.upsert).not.toHaveBeenCalled();
  });

  it('400 for a non-array value', async () => {
    const res = mockRes();
    await ConfigController.update(mockReq({ params: { key: 'weapon_types' }, body: { value: 'nope' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 for an empty array', async () => {
    const res = mockRes();
    await ConfigController.update(mockReq({ params: { key: 'weapon_types' }, body: { value: [] } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 for an entry missing label', async () => {
    const res = mockRes();
    await ConfigController.update(mockReq({ params: { key: 'weapon_types' }, body: { value: [{ key: 'melee' }] } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 for a key with characters outside [a-z0-9_]', async () => {
    const res = mockRes();
    const value = [{ key: 'One Handed!', label: 'Одноручна' }];
    await ConfigController.update(mockReq({ params: { key: 'weapon_types' }, body: { value } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ConfigModel.upsert).not.toHaveBeenCalled();
  });

  it('400 for duplicate keys', async () => {
    const res = mockRes();
    const value = [{ key: 'melee', label: 'A' }, { key: 'melee', label: 'B' }];
    await ConfigController.update(mockReq({ params: { key: 'weapon_types' }, body: { value } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('200 upserts a valid value', async () => {
    const value = [{ key: 'melee', label: 'Ближня' }];
    ConfigModel.upsert.mockResolvedValue({ key: 'weapon_types', value });
    const res = mockRes();
    await ConfigController.update(mockReq({ params: { key: 'weapon_types' }, body: { value } }), res);
    expect(ConfigModel.upsert).toHaveBeenCalledWith('weapon_types', value);
    expect(res.json).toHaveBeenCalledWith({ config: { key: 'weapon_types', value } });
  });
});

describe('ConfigController.update — conditions', () => {
  const valid = [
    { key: 'exhaustion', label: 'Втома', description: 'Опис', max_level: 6 },
    { key: 'injury', label: 'Поранення', description: '', max_level: null },
  ];
  const put = async (value) => {
    const res = mockRes();
    await ConfigController.update(mockReq({ params: { key: 'conditions' }, body: { value } }), res);
    return res;
  };

  it('200 for a valid list and stores descriptions as-is', async () => {
    ConfigModel.upsert.mockResolvedValue({ key: 'conditions', value: valid });
    const res = await put(valid);
    expect(ConfigModel.upsert).toHaveBeenCalledWith('conditions', valid);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('400 for a non-integer max_level', async () => {
    const res = await put([{ key: 'x', label: 'X', max_level: 2.5 }]);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 for a too-long description', async () => {
    const res = await put([{ key: 'x', label: 'X', description: 'a'.repeat(2001) }]);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('ConfigController.update — currencies', () => {
  const pair = (key, high, low, extra = {}) => ({
    key, label: key, description: '', convertible: true, rate: 100,
    high: { key: high, name: high, metal: 'золото' },
    low: { key: low, name: low, metal: 'срібло' },
    ...extra,
  });
  const put = async (value) => {
    const res = mockRes();
    await ConfigController.update(mockReq({ params: { key: 'currencies' }, body: { value } }), res);
    return res;
  };

  it('200 for valid pairs, including a non-convertible one without a rate', async () => {
    const value = [pair('arbor', 'alios', 'delios'), pair('other', 'gold', 'gems', { convertible: false, rate: null })];
    ConfigModel.upsert.mockResolvedValue({ key: 'currencies', value });
    const res = await put(value);
    expect(res.status).not.toHaveBeenCalled();
    expect(ConfigModel.upsert).toHaveBeenCalledWith('currencies', value);
  });

  it('400 when a denomination key repeats across pairs', async () => {
    const res = await put([pair('a', 'alios', 'delios'), pair('b', 'alios', 'other')]);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 for a convertible pair without a valid rate', async () => {
    const res = await put([pair('a', 'alios', 'delios', { rate: 1 })]);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 for a denomination key with invalid characters', async () => {
    const res = await put([pair('a', 'Альґос', 'delios')]);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 when a denomination is missing', async () => {
    const res = await put([{ ...pair('a', 'alios', 'delios'), low: undefined }]);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('ConfigController.update — magic_forms', () => {
  const valid = ['arcana', 'elemental', 'integral', 'pact', 'nature', 'blight']
    .map((key) => ({ key, label: key.toUpperCase(), description: `Опис ${key}` }));
  const put = async (value) => {
    const res = mockRes();
    await ConfigController.update(mockReq({ params: { key: 'magic_forms' }, body: { value } }), res);
    return res;
  };

  it('200 for the full fixed set with edited names and descriptions', async () => {
    ConfigModel.upsert.mockResolvedValue({ key: 'magic_forms', value: valid });
    const res = await put(valid);
    expect(ConfigModel.upsert).toHaveBeenCalledWith('magic_forms', valid);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('400 when a form is missing', async () => {
    const res = await put(valid.slice(1));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ConfigModel.upsert).not.toHaveBeenCalled();
  });

  it('400 when an unknown form key is added', async () => {
    const res = await put([...valid, { key: 'extra', label: 'Extra' }]);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 for a too-long description', async () => {
    const res = await put(valid.map((e, i) => (i === 0 ? { ...e, description: 'a'.repeat(2001) } : e)));
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('ConfigController.update — character_races', () => {
  const R1 = '7fdf6fb8-3681-462c-b8a9-d1bcca887851';
  const R2 = 'a1b2c3d4-0000-4000-8000-000000000002';
  const P1 = '0b8a4a1e-3c1d-4d49-9a4e-1f1b7c2d3e41';
  const P2 = '5c6d7e8f-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
  const race = {
    race_id: R1, bonus_characteristic: 'agility', bonus_budget: 0,
    peoples: [{ people_id: P1, skill_bonuses: [{ skill: 'strength', value: 1 }] }],
  };
  const put = async (value) => {
    const res = mockRes();
    await ConfigController.update(mockReq({ params: { key: 'character_races' }, body: { value } }), res);
    return res;
  };
  const withPeople = (peoples) => [{ ...race, peoples }];

  it('200 for a valid list', async () => {
    ConfigModel.upsert.mockResolvedValue({ key: 'character_races', value: [race] });
    const res = await put([race]);
    expect(ConfigModel.upsert).toHaveBeenCalledWith('character_races', [race]);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('200 for an empty list (no races opened yet)', async () => {
    ConfigModel.upsert.mockResolvedValue({ key: 'character_races', value: [] });
    expect((await put([])).status).not.toHaveBeenCalled();
  });

  it('200 for a race without mechanics or peoples, and the same people under two races', async () => {
    ConfigModel.upsert.mockResolvedValue({ key: 'character_races', value: [] });
    const res = await put([
      { race_id: R1, bonus_characteristic: null, bonus_budget: 4 },
      { race_id: R2, peoples: [{ people_id: P1 }, { people_id: P2, skill_bonuses: [] }] },
    ]);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('400 for a non-array value', async () => {
    expect((await put({})).status).toHaveBeenCalledWith(400);
  });

  it('400 for a race_id that is not a UUID', async () => {
    expect((await put([{ ...race, race_id: 'human' }])).status).toHaveBeenCalledWith(400);
  });

  it('400 when the same race is added twice', async () => {
    expect((await put([race, race])).status).toHaveBeenCalledWith(400);
  });

  it('400 for an unknown bonus characteristic', async () => {
    expect((await put([{ ...race, bonus_characteristic: 'luck' }])).status).toHaveBeenCalledWith(400);
  });

  it.each([-1, 21, 1.5, '4'])('400 for bonus_budget %p', async (bonus_budget) => {
    expect((await put([{ ...race, bonus_budget }])).status).toHaveBeenCalledWith(400);
  });

  it('400 for a people_id that is not a UUID', async () => {
    expect((await put(withPeople([{ people_id: 'nope' }]))).status).toHaveBeenCalledWith(400);
  });

  it('400 when the same people is added twice to one race', async () => {
    expect((await put(withPeople([{ people_id: P1 }, { people_id: P1 }]))).status).toHaveBeenCalledWith(400);
  });

  it('400 for an unknown skill', async () => {
    const res = await put(withPeople([{ people_id: P1, skill_bonuses: [{ skill: 'luck', value: 1 }] }]));
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 when a skill repeats within one people', async () => {
    const dup = [{ skill: 'strength', value: 1 }, { skill: 'strength', value: 2 }];
    expect((await put(withPeople([{ people_id: P1, skill_bonuses: dup }]))).status).toHaveBeenCalledWith(400);
  });

  it.each([0, 6, 1.5, '2'])('400 for people bonus value %p', async (value) => {
    const res = await put(withPeople([{ people_id: P2, skill_bonuses: [{ skill: 'will', value }] }]));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ConfigModel.upsert).not.toHaveBeenCalled();
  });
});

describe('ConfigController.update — event_types', () => {
  const put = (value) => ({ params: { key: 'event_types' }, body: { value } });

  beforeEach(() => {
    ConfigModel.upsert.mockImplementation(async (key, value) => ({ key, value }));
  });

  it('200 for valid types with colors', async () => {
    const res = mockRes();
    await ConfigController.update(mockReq(put([{ key: 'battle', label: 'Битва', color: '#d9534f' }])), res);
    expect(res.status).not.toHaveBeenCalled();
    expect(ConfigModel.upsert).toHaveBeenCalled();
  });

  it('200 for an empty list (events fall back to their own color)', async () => {
    const res = mockRes();
    await ConfigController.update(mockReq(put([])), res);
    expect(res.status).not.toHaveBeenCalled();
    expect(ConfigModel.upsert).toHaveBeenCalledWith('event_types', []);
  });

  it('400 for a missing or malformed color', async () => {
    for (const color of [undefined, 'red', '#fff']) {
      const res = mockRes();
      await ConfigController.update(mockReq(put([{ key: 'battle', label: 'Битва', color }])), res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(ConfigModel.upsert).not.toHaveBeenCalled();
  });

  it('400 for duplicate keys', async () => {
    const res = mockRes();
    await ConfigController.update(mockReq(put([
      { key: 'a', label: 'A', color: '#000000' }, { key: 'a', label: 'B', color: '#111111' },
    ])), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
