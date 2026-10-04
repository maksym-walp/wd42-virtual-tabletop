jest.mock('../../config/db');

const pool = require('../../config/db');
const CreatureModel = require('../creature.model');

const ATTRS = { dexterity: 3, body: 4, intelligence: 2, wisdom: 5, charisma: 1 };

beforeEach(() => jest.clearAllMocks());

describe('CreatureModel health die resolution', () => {
  it('resolves override -> subspecies -> species -> d6 via cross-schema compendium joins', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await CreatureModel.findAll('u1', false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/COALESCE\(c\.health_die_override, sub\.health_die, sp\.health_die, 'd6'\)/);
    expect(sql).toMatch(/LEFT JOIN compendium\.species sp/);
    expect(sql).toMatch(/LEFT JOIN compendium\.subspecies sub/);
    expect(sql).toMatch(/\$2::bool OR c\.created_by = \$1 OR c\.is_public = true/);
    expect(params).toEqual(['u1', false]);
  });
});

describe('CreatureModel.create', () => {
  it('inserts into bestiary.creatures with every column in order, crop dropped without an image', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    await CreatureModel.create({
      createdBy: 'u1', name: 'Wolf', speciesId: 's1', history: 'woods', healthDieOverride: 'd10',
      isPublic: true, attributes: ATTRS, imageCrop: { x: 50, y: 50, zoom: 1, ratio: 1 },
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO bestiary\.creatures \(created_by, name, species_id/);
    expect(sql).toMatch(/\$17::jsonb/);
    expect(params).toEqual(['u1', 'Wolf', 's1', null, null, null, null, 'woods', null,
      3, 4, 2, 5, 1, 'd10', true, null]);
  });
});

describe('CreatureModel.update', () => {
  it('updates by id with the same column order', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    await CreatureModel.update('c1', { name: 'Wolf', attributes: ATTRS, imageUrl: '/u/x.jpg' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE bestiary\.creatures/);
    expect(sql).toMatch(/name = \$2, species_id = \$3/);
    expect(sql).toMatch(/image_crop = \$17::jsonb, updated_at = NOW\(\)/);
    expect(params[0]).toBe('c1');
    expect(params[8]).toBe('/u/x.jpg');
    expect(params).toHaveLength(17);
  });
});
