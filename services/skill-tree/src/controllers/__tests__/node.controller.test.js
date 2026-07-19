jest.mock('../../models/node.model');

const NodeModel = require('../../models/node.model');
const NodeController = require('../node.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

beforeEach(() => jest.clearAllMocks());

describe('NodeController.list', () => {
  it('calls NodeModel.findAll with race and archetype both undefined when neither query param is given', async () => {
    NodeModel.findAll.mockResolvedValue([]);
    const req = { query: {} };
    const res = mockRes();
    await NodeController.list(req, res);
    expect(NodeModel.findAll).toHaveBeenCalledWith({ race: undefined, archetype: undefined });
  });

  it('passes race through when only ?race= is given', async () => {
    NodeModel.findAll.mockResolvedValue([]);
    const req = { query: { race: 'elf' } };
    const res = mockRes();
    await NodeController.list(req, res);
    expect(NodeModel.findAll).toHaveBeenCalledWith({ race: 'elf', archetype: undefined });
  });

  it('passes archetype through when only ?archetype= is given', async () => {
    NodeModel.findAll.mockResolvedValue([]);
    const req = { query: { archetype: 'fighter' } };
    const res = mockRes();
    await NodeController.list(req, res);
    expect(NodeModel.findAll).toHaveBeenCalledWith({ race: undefined, archetype: 'fighter' });
  });

  it('passes both race and archetype through when both query params are given', async () => {
    NodeModel.findAll.mockResolvedValue([]);
    const req = { query: { race: 'elf', archetype: 'fighter' } };
    const res = mockRes();
    await NodeController.list(req, res);
    expect(NodeModel.findAll).toHaveBeenCalledWith({ race: 'elf', archetype: 'fighter' });
  });

  it('returns the nodes from the model as JSON', async () => {
    const nodes = [{ id: 'n1' }, { id: 'n2' }];
    NodeModel.findAll.mockResolvedValue(nodes);
    const req = { query: {} };
    const res = mockRes();
    await NodeController.list(req, res);
    expect(res.json).toHaveBeenCalledWith({ nodes });
  });
});

describe('NodeController.create', () => {
  // No validation currently exists on create — this documents actual current
  // behavior: the raw req.body is forwarded to the model as-is, even empty.
  it('forwards req.body straight to NodeModel.create with no validation', async () => {
    NodeModel.create.mockResolvedValue({ id: 'n1' });
    const req = { body: {} };
    const res = mockRes();
    await NodeController.create(req, res);
    expect(NodeModel.create).toHaveBeenCalledWith({});
  });

  it('returns 201 with the created node on success', async () => {
    NodeModel.create.mockResolvedValue({ id: 'n1', title: 'Test' });
    const req = { body: { title: 'Test' } };
    const res = mockRes();
    await NodeController.create(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ node: { id: 'n1', title: 'Test' } });
  });

  it('rethrows unrelated errors instead of swallowing them (no try/catch in this controller)', async () => {
    const err = new Error('unexpected');
    NodeModel.create.mockRejectedValue(err);
    const req = { body: { title: 'Test' } };
    const res = mockRes();
    await expect(NodeController.create(req, res)).rejects.toBe(err);
  });
});

describe('NodeController.update', () => {
  it('returns 404 when the model finds nothing to update', async () => {
    NodeModel.update.mockResolvedValue(null);
    const req = { params: { id: 'missing' }, body: { title: 'X' } };
    const res = mockRes();
    await NodeController.update(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Вузол не знайдено' });
  });

  it('returns 200 with the updated node on success', async () => {
    NodeModel.update.mockResolvedValue({ id: 'n1', title: 'Updated' });
    const req = { params: { id: 'n1' }, body: { title: 'Updated' } };
    const res = mockRes();
    await NodeController.update(req, res);
    expect(NodeModel.update).toHaveBeenCalledWith('n1', { title: 'Updated' });
    expect(res.json).toHaveBeenCalledWith({ node: { id: 'n1', title: 'Updated' } });
  });

  it('rethrows unrelated errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    NodeModel.update.mockRejectedValue(err);
    const req = { params: { id: 'n1' }, body: {} };
    const res = mockRes();
    await expect(NodeController.update(req, res)).rejects.toBe(err);
  });
});

describe('NodeController.remove', () => {
  it('returns 404 when nothing was deleted', async () => {
    NodeModel.delete.mockResolvedValue(false);
    const req = { params: { id: 'missing' } };
    const res = mockRes();
    await NodeController.remove(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Вузол не знайдено' });
  });

  it('returns a success message when deletion succeeds', async () => {
    NodeModel.delete.mockResolvedValue(true);
    const req = { params: { id: 'n1' } };
    const res = mockRes();
    await NodeController.remove(req, res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Видалено' });
  });

  it('rethrows unrelated errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    NodeModel.delete.mockRejectedValue(err);
    const req = { params: { id: 'n1' } };
    const res = mockRes();
    await expect(NodeController.remove(req, res)).rejects.toBe(err);
  });
});
