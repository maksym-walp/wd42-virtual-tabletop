jest.mock('../../models/campaign.model');
jest.mock('../../models/campaign-character.model');
jest.mock('../../models/board-item.model');
jest.mock('../../models/board-source.model', () => ({
  SOURCE_KINDS: ['npc', 'creature', 'spell', 'ability', 'faction', 'location', 'map', 'equipment'],
  EQUIPMENT_SUBTYPES: ['item', 'weapon', 'armor', 'artifact'],
  resolve: jest.fn(),
}));

const CampaignModel = require('../../models/campaign.model');
const CampaignCharacterModel = require('../../models/campaign-character.model');
const BoardItemModel = require('../../models/board-item.model');
const BoardSourceModel = require('../../models/board-source.model');
const BoardController = require('../board.controller');
const bus = require('../../realtime/bus');

const REF_ID = '11111111-1111-4111-8111-111111111111';
const GM = { sub: 'gm-1', role: 'user' };
const PLAYER = { sub: 'player-1', role: 'user' };
const ADMIN = { sub: 'admin-1', role: 'admin' };

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}

function mockReq({ body = {}, params = {}, query = {}, user = GM } = {}) {
  return { body, params: { id: 'c1', ...params }, query, user };
}

let topics;
let unsubscribe;
beforeEach(() => {
  jest.clearAllMocks();
  CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
  topics = [];
  unsubscribe = bus.subscribe('c1', (t) => topics.push(t));
});
afterEach(() => unsubscribe());

describe('BoardController.list', () => {
  it('gives a player only the visible table, scoped by the model', async () => {
    CampaignCharacterModel.isMember.mockResolvedValue(true);
    BoardItemModel.listByZone.mockResolvedValue([{ id: 'b1' }]);
    const res = mockRes();

    await BoardController.list(mockReq({ query: { zone: 'table' }, user: PLAYER }), res);

    expect(BoardItemModel.listByZone).toHaveBeenCalledWith('c1', 'table', {
      manager: false, userId: 'player-1', admin: false,
    });
    expect(res.json).toHaveBeenCalledWith({ items: [{ id: 'b1' }] });
  });

  it('403s a player asking for the Screen', async () => {
    const res = mockRes();
    await BoardController.list(mockReq({ query: { zone: 'screen' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(BoardItemModel.listByZone).not.toHaveBeenCalled();
  });

  it('403s a stranger asking for the table', async () => {
    CampaignCharacterModel.isMember.mockResolvedValue(false);
    const res = mockRes();
    await BoardController.list(mockReq({ user: { sub: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('lets an admin who is not a member read the Screen', async () => {
    BoardItemModel.listByZone.mockResolvedValue([]);
    const res = mockRes();
    await BoardController.list(mockReq({ query: { zone: 'screen' }, user: ADMIN }), res);
    expect(BoardItemModel.listByZone).toHaveBeenCalledWith('c1', 'screen', {
      manager: true, userId: 'admin-1', admin: true,
    });
    expect(CampaignCharacterModel.isMember).not.toHaveBeenCalled();
  });

  it('400s an unknown zone', async () => {
    const res = mockRes();
    await BoardController.list(mockReq({ query: { zone: 'attic' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('BoardController.add', () => {
  it('403s a player', async () => {
    const res = mockRes();
    await BoardController.add(mockReq({ body: { kind: 'note', title: 'x' }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(BoardItemModel.create).not.toHaveBeenCalled();
  });

  it('snapshots a catalog entry onto the Screen and notifies managers only', async () => {
    BoardSourceModel.resolve.mockResolvedValue({
      title: 'Гоблін', subtitle: 'Гуманоїди', image_url: '/uploads/g.png', image_crop: null, content: '<p>Злий</p>',
    });
    BoardItemModel.create.mockResolvedValue({ id: 'b1', zone: 'screen' });
    const res = mockRes();

    await BoardController.add(mockReq({ body: { zone: 'screen', kind: 'creature', ref_id: REF_ID } }), res);

    expect(BoardSourceModel.resolve).toHaveBeenCalledWith('creature', REF_ID, undefined, GM);
    expect(BoardItemModel.create).toHaveBeenCalledWith('c1', expect.objectContaining({
      zone: 'screen', kind: 'creature', ref_id: REF_ID, title: 'Гоблін', content: '<p>Злий</p>', is_visible: false,
    }), 'gm-1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(topics).toEqual(['screen']);
  });

  it('404s when the source is missing or not readable by the GM', async () => {
    BoardSourceModel.resolve.mockResolvedValue(null);
    const res = mockRes();
    await BoardController.add(mockReq({ body: { kind: 'npc', ref_id: REF_ID } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(BoardItemModel.create).not.toHaveBeenCalled();
  });

  it('requires a known equipment subtype', async () => {
    const res = mockRes();
    await BoardController.add(mockReq({ body: { kind: 'equipment', ref_id: REF_ID, ref_subtype: 'boat' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('409s a map that is already on the board', async () => {
    BoardItemModel.mapOnBoard.mockResolvedValue(true);
    const res = mockRes();
    await BoardController.add(mockReq({ body: { kind: 'map', ref_id: REF_ID } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('rejects javascript: image urls', async () => {
    const res = mockRes();
    await BoardController.add(mockReq({ body: { kind: 'image', image_url: 'javascript:alert(1)' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates a visible note on the table when asked', async () => {
    BoardItemModel.create.mockResolvedValue({ id: 'b2', zone: 'table' });
    const res = mockRes();
    await BoardController.add(mockReq({ body: { kind: 'note', title: ' Підказка ', content: '<p>a</p>', is_visible: true } }), res);
    expect(BoardItemModel.create).toHaveBeenCalledWith('c1', expect.objectContaining({
      zone: 'table', kind: 'note', title: 'Підказка', is_visible: true,
    }), 'gm-1');
    expect(topics).toEqual(['board']);
  });

  it('400s an unknown kind', async () => {
    const res = mockRes();
    await BoardController.add(mockReq({ body: { kind: 'dragon' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('BoardController.update', () => {
  it('moves a Screen card onto the table and notifies both audiences', async () => {
    BoardItemModel.findById.mockResolvedValue({ id: 'b1', zone: 'screen' });
    BoardItemModel.moveToZone.mockResolvedValue({ id: 'b1', zone: 'table', is_visible: false });
    BoardItemModel.updateFields.mockResolvedValue({ id: 'b1', zone: 'table', is_visible: false });
    const res = mockRes();

    await BoardController.update(mockReq({ params: { itemId: 'b1' }, body: { zone: 'table' } }), res);

    expect(BoardItemModel.moveToZone).toHaveBeenCalledWith('b1', 'c1', 'table');
    expect(topics.sort()).toEqual(['board', 'screen']);
    expect(res.json).toHaveBeenCalledWith({ item: { id: 'b1', zone: 'table', is_visible: false } });
  });

  it('toggles visibility and featured flags', async () => {
    BoardItemModel.findById.mockResolvedValue({ id: 'b1', zone: 'table' });
    BoardItemModel.setVisible.mockResolvedValue({ id: 'b1', zone: 'table', is_visible: true });
    BoardItemModel.setFeatured.mockResolvedValue({ id: 'b1', zone: 'table', is_featured: true });
    BoardItemModel.updateFields.mockResolvedValue({ id: 'b1', zone: 'table', is_visible: true, is_featured: true });

    await BoardController.update(mockReq({ params: { itemId: 'b1' }, body: { is_visible: true, is_featured: true } }), mockRes());

    expect(BoardItemModel.setVisible).toHaveBeenCalledWith('b1', 'c1', true);
    expect(BoardItemModel.setFeatured).toHaveBeenCalledWith('b1', 'c1', true);
    expect(BoardItemModel.moveToZone).not.toHaveBeenCalled();
    expect(topics).toEqual(['board']);
  });

  it('404s an item from another campaign', async () => {
    BoardItemModel.findById.mockResolvedValue(null);
    const res = mockRes();
    await BoardController.update(mockReq({ params: { itemId: 'zzz' }, body: { is_visible: true } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('403s a player', async () => {
    const res = mockRes();
    await BoardController.update(mockReq({ params: { itemId: 'b1' }, body: { is_visible: true }, user: PLAYER }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(BoardItemModel.setVisible).not.toHaveBeenCalled();
  });

  it('rejects an empty title', async () => {
    BoardItemModel.findById.mockResolvedValue({ id: 'b1', zone: 'table' });
    const res = mockRes();
    await BoardController.update(mockReq({ params: { itemId: 'b1' }, body: { title: '   ' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('BoardController.refresh', () => {
  it('re-reads the snapshot from its source', async () => {
    BoardItemModel.findById.mockResolvedValue({ id: 'b1', zone: 'table', kind: 'npc', ref_id: REF_ID, ref_subtype: null });
    BoardSourceModel.resolve.mockResolvedValue({ title: 'Новий', content: 'x' });
    BoardItemModel.updateFields.mockResolvedValue({ id: 'b1', zone: 'table', title: 'Новий' });
    const res = mockRes();

    await BoardController.refresh(mockReq({ params: { itemId: 'b1' } }), res);

    expect(BoardItemModel.updateFields).toHaveBeenCalledWith('b1', 'c1', expect.objectContaining({ title: 'Новий', content: 'x' }));
    expect(topics).toEqual(['board']);
  });

  it('400s an item without a source', async () => {
    BoardItemModel.findById.mockResolvedValue({ id: 'b1', zone: 'table', kind: 'note', ref_id: null });
    const res = mockRes();
    await BoardController.refresh(mockReq({ params: { itemId: 'b1' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('BoardController.reorder', () => {
  it('validates ids and saves the new order', async () => {
    const res = mockRes();
    await BoardController.reorder(mockReq({ body: { zone: 'table', ids: [REF_ID] } }), res);
    expect(BoardItemModel.reorder).toHaveBeenCalledWith('c1', 'table', [REF_ID]);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(topics).toEqual(['board']);
  });

  it('400s non-uuid ids', async () => {
    const res = mockRes();
    await BoardController.reorder(mockReq({ body: { zone: 'table', ids: ['1; DROP'] } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(BoardItemModel.reorder).not.toHaveBeenCalled();
  });
});

describe('BoardController.remove', () => {
  it('deletes and notifies the zone audience', async () => {
    BoardItemModel.remove.mockResolvedValue({ id: 'b1', zone: 'screen' });
    const res = mockRes();
    await BoardController.remove(mockReq({ params: { itemId: 'b1' } }), res);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(topics).toEqual(['screen']);
  });

  it('404s a missing item', async () => {
    BoardItemModel.remove.mockResolvedValue(null);
    const res = mockRes();
    await BoardController.remove(mockReq({ params: { itemId: 'b1' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
