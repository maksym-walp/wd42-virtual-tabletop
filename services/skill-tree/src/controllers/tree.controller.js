const NodeModel = require('../models/node.model');
const EdgeModel = require('../models/edge.model');
const TreeModel = require('../models/tree.model');

const TreeController = {
  async export(req, res) {
    const { archetype } = req.query;
    const nodes = await NodeModel.findAll({ archetype });
    const edges = await EdgeModel.findAll({ archetype });
    res.json({ nodes, edges });
  },

  async import(req, res) {
    const { nodes, edges, archetype } = req.body;
    if (!Array.isArray(nodes) || !Array.isArray(edges) || !archetype) {
      return res.status(400).json({ message: 'Невірний формат. Очікується { nodes: [], edges: [], archetype }' });
    }
    const mismatched = nodes.find((n) => n.archetype && n.archetype !== archetype);
    if (mismatched) {
      return res.status(400).json({
        message: `Вузол «${mismatched.title}» належить іншому архетипу (${mismatched.archetype}), а не «${archetype}»`,
      });
    }
    await TreeModel.importTree(nodes, edges, archetype);
    res.json({ message: 'Дерево імпортовано', nodeCount: nodes.length, edgeCount: edges.length });
  },
};

module.exports = TreeController;
