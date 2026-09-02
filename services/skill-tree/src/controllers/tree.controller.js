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

  // Additive import of one node or a node + its branches. Non-destructive —
  // imported nodes get fresh ids and (optionally) attach under a chosen node.
  async importNodes(req, res) {
    const { nodes, edges, archetype, attach_to_node_id } = req.body;
    if (!Array.isArray(nodes) || !Array.isArray(edges) || !archetype) {
      return res.status(400).json({ message: 'Невірний формат. Очікується { nodes: [], edges: [], archetype }' });
    }
    if (nodes.length === 0) {
      return res.status(400).json({ message: 'Немає вузлів для імпорту' });
    }
    if (attach_to_node_id) {
      const parent = await NodeModel.findById(attach_to_node_id);
      if (!parent) return res.status(400).json({ message: 'Батьківський вузол не знайдено' });
      if (parent.archetype && parent.archetype !== archetype) {
        return res.status(400).json({ message: 'Батьківський вузол належить іншому архетипу' });
      }
    }
    const result = await TreeModel.importNodes(nodes, edges, archetype, attach_to_node_id ?? null);
    res.json({ message: 'Вузли імпортовано', ...result });
  },
};

module.exports = TreeController;
