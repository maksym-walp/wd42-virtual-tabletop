jest.mock('../../models/equipment.model');
jest.mock('../../models/prerequisite.model');
jest.mock('../authorize-character-write');

const EquipmentModel = require('../../models/equipment.model');
const { isVisibleToUser } = require('../../models/prerequisite.model');
const authorizeCharacterWrite = require('../authorize-character-write');
const EquipmentController = require('../equipment.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq(overrides = {}) {
  return { params: {}, body: {}, user: { sub: 'user-1' }, ...overrides };
}

beforeEach(() => jest.clearAllMocks());

describe('EquipmentController.list', () => {
  it('lists equipment for the character without an auth check', async () => {
    EquipmentModel.findAll.mockResolvedValue([{ id: 'e1' }]);
    const req = mockReq({ params: { id: 'c1' } });
    const res = mockRes();

    await EquipmentController.list(req, res);

    expect(EquipmentModel.findAll).toHaveBeenCalledWith('c1');
    expect(res.json).toHaveBeenCalledWith({ equipment: [{ id: 'e1' }] });
  });
});

describe('EquipmentController.add', () => {
  it('stops without further calls when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1' }, body: { equipment_id: 'e1' } });
    const res = mockRes();

    await EquipmentController.add(req, res);

    expect(isVisibleToUser).not.toHaveBeenCalled();
    expect(EquipmentModel.add).not.toHaveBeenCalled();
  });

  it('400s when equipment_id is missing', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    const req = mockReq({ params: { id: 'c1' }, body: {} });
    const res = mockRes();

    await EquipmentController.add(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(isVisibleToUser).not.toHaveBeenCalled();
  });

  it('404s when the item is not visible to the user', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    isVisibleToUser.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1' }, body: { equipment_id: 'e1' }, user: { sub: 'u1' } });
    const res = mockRes();

    await EquipmentController.add(req, res);

    expect(isVisibleToUser).toHaveBeenCalledWith('equipment.items', 'e1', 'u1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(EquipmentModel.add).not.toHaveBeenCalled();
  });

  it('201s and adds the item when visible (no prerequisite gate for equipment)', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    isVisibleToUser.mockResolvedValue(true);
    EquipmentModel.add.mockResolvedValue({ id: 'link-1', equipment_id: 'e1' });
    const req = mockReq({ params: { id: 'c1' }, body: { equipment_id: 'e1' } });
    const res = mockRes();

    await EquipmentController.add(req, res);

    expect(EquipmentModel.add).toHaveBeenCalledWith('c1', 'e1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ item: { id: 'link-1', equipment_id: 'e1' } });
  });
});

describe('EquipmentController.patch', () => {
  it('stops without touching the model when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', equipmentId: 'e1' }, body: { mastery_count: 3 } });
    const res = mockRes();

    await EquipmentController.patch(req, res);

    expect(EquipmentModel.patch).not.toHaveBeenCalled();
  });

  it('404s when the item is not in the sheet', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    EquipmentModel.patch.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', equipmentId: 'e1' }, body: {} });
    const res = mockRes();

    await EquipmentController.patch(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // Exact-field forwarding matters: extra body fields must not leak into the model call.
  it('forwards exactly mastery_count and mastered to the model, dropping other body fields', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    EquipmentModel.patch.mockResolvedValue({ id: 'link-1', mastery_count: 3, mastered: true });
    const req = mockReq({
      params: { id: 'c1', equipmentId: 'e1' },
      body: { mastery_count: 3, mastered: true, name: 'sneaky extra field', notes: 'ignored' },
    });
    const res = mockRes();

    await EquipmentController.patch(req, res);

    expect(EquipmentModel.patch).toHaveBeenCalledWith('c1', 'e1', { mastery_count: 3, mastered: true });
    expect(res.json).toHaveBeenCalledWith({ item: { id: 'link-1', mastery_count: 3, mastered: true } });
  });

  it('forwards undefined fields as undefined when omitted from the body', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    EquipmentModel.patch.mockResolvedValue({ id: 'link-1' });
    const req = mockReq({ params: { id: 'c1', equipmentId: 'e1' }, body: { mastery_count: 1 } });
    const res = mockRes();

    await EquipmentController.patch(req, res);

    expect(EquipmentModel.patch).toHaveBeenCalledWith('c1', 'e1', { mastery_count: 1, mastered: undefined });
  });
});

describe('EquipmentController.remove', () => {
  it('stops without touching the model when authorization fails', async () => {
    authorizeCharacterWrite.mockResolvedValue(null);
    const req = mockReq({ params: { id: 'c1', equipmentId: 'e1' } });
    const res = mockRes();

    await EquipmentController.remove(req, res);

    expect(EquipmentModel.remove).not.toHaveBeenCalled();
  });

  it('404s when nothing was removed', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    EquipmentModel.remove.mockResolvedValue(false);
    const req = mockReq({ params: { id: 'c1', equipmentId: 'e1' } });
    const res = mockRes();

    await EquipmentController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('confirms removal on success', async () => {
    authorizeCharacterWrite.mockResolvedValue({ id: 'c1' });
    EquipmentModel.remove.mockResolvedValue(true);
    const req = mockReq({ params: { id: 'c1', equipmentId: 'e1' } });
    const res = mockRes();

    await EquipmentController.remove(req, res);

    expect(EquipmentModel.remove).toHaveBeenCalledWith('c1', 'e1');
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });
});
