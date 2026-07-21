const ArtifactModel = require('../models/artifact.model');

const ArtifactController = {
  async list(req, res) {
    const { rarity, creator, search, sort, dir, scope, limit } = req.query;
    const artifacts = await ArtifactModel.findAll(req.user.sub, {
      rarity, creator, search, sort, dir, scope, limit,
    }, req.user.role === 'admin');
    res.json({ artifacts });
  },

  async getOne(req, res) {
    const artifact = await ArtifactModel.findById(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!artifact) return res.status(404).json({ message: 'Артефакт не знайдено' });
    res.json({ artifact });
  },

  async create(req, res) {
    if (!req.body.name) return res.status(400).json({ message: 'name є обовʼязковим' });
    const artifact = await ArtifactModel.create(req.user.sub, req.body);
    res.status(201).json({ artifact });
  },

  async update(req, res) {
    const artifact = await ArtifactModel.update(req.params.id, req.user.sub, req.body, req.user.role === 'admin');
    if (!artifact) return res.status(404).json({ message: 'Артефакт не знайдено або недостатньо прав' });
    res.json({ artifact });
  },

  async remove(req, res) {
    const deleted = await ArtifactModel.delete(req.params.id, req.user.sub, req.user.role === 'admin');
    if (!deleted) return res.status(404).json({ message: 'Артефакт не знайдено або недостатньо прав' });
    res.json({ message: 'Видалено' });
  },

  // GM/admin only (route-gated) — mark someone else's artifact canonical.
  async setCanonical(req, res) {
    const isCanonical = req.body.is_canonical ?? true;
    const artifact = await ArtifactModel.setCanonical(req.params.id, isCanonical);
    if (!artifact) return res.status(404).json({ message: 'Артефакт не знайдено' });
    res.json({ artifact });
  },
};

module.exports = ArtifactController;
