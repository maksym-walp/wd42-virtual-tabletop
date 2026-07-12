const NodeModel = require('../models/node.model');
const EdgeModel = require('../models/edge.model');
const TreeModel = require('../models/tree.model');

const TreeController = {
  async export(req, res) {
    const nodes = await NodeModel.findAll();
    const edges = await EdgeModel.findAll();
    res.json({ nodes, edges });
  },

  async import(req, res) {
    const { nodes, edges } = req.body;
    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      return res.status(400).json({ message: 'Невірний формат. Очікується { nodes: [], edges: [] }' });
    }
    await TreeModel.importTree(nodes, edges);
    res.json({ message: 'Дерево імпортовано', nodeCount: nodes.length, edgeCount: edges.length });
  },
};

module.exports = TreeController;
