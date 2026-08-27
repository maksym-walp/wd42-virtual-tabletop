jest.mock('../../models/map.model');
jest.mock('../../models/campaign-membership.model');

const MapModel = require('../../models/map.model');
const CampaignMembershipModel = require('../../models/campaign-membership.model');
const {
  isAdmin, canCreate, canReadMap, canWriteMap, canWriteLocation, stripGmNote, loadMapOr404, isCampaignMember,
} = require('../access');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
}

beforeEach(() => jest.clearAllMocks());

const owner = { sub: 'owner-1', role: 'game_master' };
const player = { sub: 'p-1', role: 'user' };
const admin = { sub: 'a-1', role: 'admin' };
const publicMap = { id: 'm1', created_by: 'owner-1', is_public: true };
const privateMap = { id: 'm2', created_by: 'owner-1', is_public: false };

describe('canCreate', () => {
  it('allows only game_master and admin', () => {
    expect(canCreate({ role: 'game_master' })).toBe(true);
    expect(canCreate({ role: 'admin' })).toBe(true);
    expect(canCreate({ role: 'user' })).toBe(false);
  });
});

describe('canReadMap', () => {
  it('owner reads own private map', () => expect(canReadMap(privateMap, owner)).toBe(true));
  it('non-owner cannot read a private map', () => expect(canReadMap(privateMap, player)).toBe(false));
  it('anyone reads a public map', () => expect(canReadMap(publicMap, player)).toBe(true));
  it('admin reads any map', () => expect(canReadMap(privateMap, admin)).toBe(true));
});

describe('canWriteMap', () => {
  it('owner may write', () => expect(canWriteMap(privateMap, owner)).toBe(true));
  it('a public map is still not writable by others', () => expect(canWriteMap(publicMap, player)).toBe(false));
  it('admin may write any map', () => expect(canWriteMap(privateMap, admin)).toBe(true));
});

describe('canWriteLocation', () => {
  const loc = { created_by: 'owner-1' };
  it('owner or admin only', () => {
    expect(canWriteLocation(loc, owner)).toBe(true);
    expect(canWriteLocation(loc, player)).toBe(false);
    expect(canWriteLocation(loc, admin)).toBe(true);
  });
});

describe('isAdmin', () => {
  it('is true only for the admin role', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(owner)).toBe(false);
  });
});

describe('stripGmNote', () => {
  const row = { id: 'loc1', name: 'X', gm_note: 'secret' };
  it('keeps gm_note for elevated viewers', () => expect(stripGmNote(row, true)).toEqual(row));
  it('removes gm_note otherwise', () => {
    expect(stripGmNote(row, false)).toEqual({ id: 'loc1', name: 'X' });
    expect(stripGmNote(row, false)).not.toHaveProperty('gm_note');
  });
});

describe('isCampaignMember', () => {
  it('delegates to CampaignMembershipModel.isMember', async () => {
    CampaignMembershipModel.isMember.mockResolvedValue(true);
    expect(await isCampaignMember('camp-1', 'p-1')).toBe(true);
    expect(CampaignMembershipModel.isMember).toHaveBeenCalledWith('camp-1', 'p-1');
  });
});

describe('loadMapOr404', () => {
  it('404s and returns null when the map is missing', async () => {
    MapModel.findById.mockResolvedValue(null);
    const res = mockRes();
    expect(await loadMapOr404('nope', res)).toBeNull();
    expect(res.status).toHaveBeenCalledWith(404);
  });
  it('returns the map when present', async () => {
    MapModel.findById.mockResolvedValue(privateMap);
    const res = mockRes();
    expect(await loadMapOr404('m2', res)).toBe(privateMap);
    expect(res.status).not.toHaveBeenCalled();
  });
});
