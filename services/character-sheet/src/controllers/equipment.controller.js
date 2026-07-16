const EquipmentModel = require('../models/equipment.model');
const { isVisibleToUser } = require('../models/prerequisite.model');
const authorizeCharacterWrite = require('./authorize-character-write');

const EquipmentController = {
  async list(req, res) {
    const equipment = await EquipmentModel.findAll(req.params.id);
    res.json({ equipment });
  },

  async add(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const { equipment_id } = req.body;
    if (!equipment_id) return res.status(400).json({ message: 'equipment_id є обовʼязковим' });
    if (!await isVisibleToUser('equipment.items', equipment_id, req.user.sub)) {
      return res.status(404).json({ message: 'Предмет не знайдено' });
    }
    const item = await EquipmentModel.add(req.params.id, equipment_id);
    res.status(201).json({ item });
  },

  async patch(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const { mastery_count, mastered } = req.body;
    const updated = await EquipmentModel.patch(req.params.id, req.params.equipmentId, { mastery_count, mastered });
    if (!updated) return res.status(404).json({ message: 'Предмет не знайдено в листі' });
    res.json({ item: updated });
  },

  async remove(req, res) {
    if (!await authorizeCharacterWrite(req, res)) return;
    const deleted = await EquipmentModel.remove(req.params.id, req.params.equipmentId);
    if (!deleted) return res.status(404).json({ message: 'Предмет не знайдено' });
    res.json({ message: 'Видалено' });
  },
};

module.exports = EquipmentController;
