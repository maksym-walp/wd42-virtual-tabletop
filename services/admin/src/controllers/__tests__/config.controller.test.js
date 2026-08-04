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
