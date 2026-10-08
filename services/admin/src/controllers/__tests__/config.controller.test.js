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
