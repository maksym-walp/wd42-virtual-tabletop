jest.mock('../../models/character-state.model');
jest.mock('../../models/equipment.model');
jest.mock('../authorize-character-write');

const CharacterStateModel = require('../../models/character-state.model');
const EquipmentModel = require('../../models/equipment.model');
const authorizeCharacterWrite = require('../authorize-character-write');
const PotionController = require('../potion.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

const req = (body) => ({ params: { id: 'c1', equipmentId: 'p1' }, body, user: { sub: 'owner' } });
const character = { id: 'c1', archetype: 'rogue', conditions: [], current_hp: 1, health_dice_values: [4, 4, 4, 4, 4, 4] };
const potionEntry = (overrides = {}) => ({
  equipment_id: 'p1', containers: 1, open_portions: 0,
  item: { name: 'Відвар зцілення (пробірка)', effect: 'healing', heal_die: 6, portions: 3 },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  authorizeCharacterWrite.mockResolvedValue(character);
  CharacterStateModel.withCharacterLock.mockImplementation((id, fn) => fn({}, { character, skills: [] }));
  CharacterStateModel.saveState.mockImplementation(async (client, id, fields) => ({ ...character, ...fields }));
});

describe('PotionController.drink', () => {
  it('400s on a bad portion count', async () => {
    const res = mockRes();
    await PotionController.drink(req({ portions: 0 }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(CharacterStateModel.withCharacterLock).not.toHaveBeenCalled();
  });

  it('404s when the potion is not on the sheet', async () => {
    EquipmentModel.findPotionForUpdate.mockResolvedValue(null);
    const res = mockRes();
    await PotionController.drink(req({ portions: 1 }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects more portions than the character has', async () => {
    EquipmentModel.findPotionForUpdate.mockResolvedValue(potionEntry());
    await expect(PotionController.drink(req({ portions: 4 }), mockRes())).rejects.toMatchObject({ statusCode: 400 });
    expect(CharacterStateModel.saveState).not.toHaveBeenCalled();
  });

  it('heals, saves the habituation state and the remaining stock', async () => {
    EquipmentModel.findPotionForUpdate.mockResolvedValue(potionEntry());
    EquipmentModel.saveStock.mockResolvedValue({ equipment_id: 'p1', containers: 0, open_portions: 1 });
    const res = mockRes();

    await PotionController.drink(req({ portions: 2 }), res);

    expect(EquipmentModel.saveStock).toHaveBeenCalledWith({}, 'c1', 'p1', { containers: 0, open_portions: 1 });
    const fields = CharacterStateModel.saveState.mock.calls[0][2];
    expect(fields.current_hp).toBeGreaterThan(1);
    expect(fields).toHaveProperty('potion_habit_rank');
    const payload = res.json.mock.calls[0][0];
    expect(payload.result).toMatchObject({ portions: 2, heal_die: 'd6', potion: { name: 'Відвар зцілення (пробірка)' } });
    expect(payload.item.item.name).toBe('Відвар зцілення (пробірка)');
    expect(payload.potions).toHaveProperty('habit_rank');
  });

  it('returns item: null when the last portion is drunk', async () => {
    EquipmentModel.findPotionForUpdate.mockResolvedValue(potionEntry({ containers: 0, open_portions: 1 }));
    EquipmentModel.saveStock.mockResolvedValue(null);
    const res = mockRes();
    await PotionController.drink(req({ portions: 1 }), res);
    expect(res.json.mock.calls[0][0].item).toBeNull();
  });
});
