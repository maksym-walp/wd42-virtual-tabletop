jest.mock('../../models/node.model');
jest.mock('../../models/edge.model');
jest.mock('../../models/tree.model');

const NodeModel = require('../../models/node.model');
const EdgeModel = require('../../models/edge.model');
const TreeModel = require('../../models/tree.model');
const TreeController = require('../tree.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

beforeEach(() => jest.clearAllMocks());

describe('TreeController.export', () => {
  it('delegates to NodeModel.findAll and EdgeModel.findAll scoped by archetype and returns both', async () => {
    const nodes = [{ id: 'n1', archetype: 'fighter' }];
    const edges = [{ id: 'e1', source_id: 'n1', target_id: 'n2' }];
    NodeModel.findAll.mockResolvedValue(nodes);
    EdgeModel.findAll.mockResolvedValue(edges);
    const req = { query: { archetype: 'fighter' } };
    const res = mockRes();
    await TreeController.export(req, res);
    expect(NodeModel.findAll).toHaveBeenCalledWith({ archetype: 'fighter' });
    expect(EdgeModel.findAll).toHaveBeenCalledWith({ archetype: 'fighter' });
    expect(res.json).toHaveBeenCalledWith({ nodes, edges });
  });

  it('rethrows unrelated errors instead of swallowing them', async () => {
    const err = new Error('unexpected');
    NodeModel.findAll.mockRejectedValue(err);
    const req = { query: {} };
    const res = mockRes();
    await expect(TreeController.export(req, res)).rejects.toBe(err);
  });
});

describe('TreeController.import validation', () => {
  it('returns 400 when nodes is not an array', async () => {
    const req = { body: { nodes: 'nope', edges: [], archetype: 'fighter' } };
    const res = mockRes();
    await TreeController.import(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Невірний формат. Очікується { nodes: [], edges: [], archetype }',
    });
    expect(TreeModel.importTree).not.toHaveBeenCalled();
  });

  it('returns 400 when edges is not an array', async () => {
    const req = { body: { nodes: [], edges: 'nope', archetype: 'fighter' } };
    const res = mockRes();
    await TreeController.import(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(TreeModel.importTree).not.toHaveBeenCalled();
  });

  it('returns 400 when archetype is missing/falsy', async () => {
    const req = { body: { nodes: [], edges: [], archetype: '' } };
    const res = mockRes();
    await TreeController.import(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(TreeModel.importTree).not.toHaveBeenCalled();
  });
});

describe('TreeController.import archetype-mismatch detection', () => {
  it('imports successfully when every node matches the target archetype (happy path)', async () => {
    const nodes = [
      { id: 'n1', title: 'A', archetype: 'fighter' },
      { id: 'n2', title: 'B', archetype: 'fighter' },
    ];
    const edges = [{ source_id: 'n1', target_id: 'n2' }];
    TreeModel.importTree.mockResolvedValue();
    const req = { body: { nodes, edges, archetype: 'fighter' } };
    const res = mockRes();
    await TreeController.import(req, res);
    expect(TreeModel.importTree).toHaveBeenCalledWith(nodes, edges, 'fighter');
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Дерево імпортовано',
      nodeCount: nodes.length,
      edgeCount: edges.length,
    });
  });

  it('treats nodes with no archetype field as matching (no mismatch raised)', async () => {
    const nodes = [{ id: 'n1', title: 'A' }];
    const edges = [];
    TreeModel.importTree.mockResolvedValue();
    const req = { body: { nodes, edges, archetype: 'fighter' } };
    const res = mockRes();
    await TreeController.import(req, res);
    expect(TreeModel.importTree).toHaveBeenCalledWith(nodes, edges, 'fighter');
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it('returns 400 naming the offending node when a node archetype differs from the target', async () => {
    const nodes = [
      { id: 'n1', title: 'A', archetype: 'fighter' },
      { id: 'n2', title: 'Мисливець', archetype: 'rogue' },
    ];
    const edges = [];
    const req = { body: { nodes, edges, archetype: 'fighter' } };
    const res = mockRes();
    await TreeController.import(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Вузол «Мисливець» належить іншому архетипу (rogue), а не «fighter»',
    });
    expect(TreeModel.importTree).not.toHaveBeenCalled();
  });

  it('rethrows unrelated errors from the model instead of swallowing them', async () => {
    const err = new Error('unexpected');
    TreeModel.importTree.mockRejectedValue(err);
    const nodes = [{ id: 'n1', title: 'A', archetype: 'fighter' }];
    const req = { body: { nodes, edges: [], archetype: 'fighter' } };
    const res = mockRes();
    await expect(TreeController.import(req, res)).rejects.toBe(err);
  });
});
