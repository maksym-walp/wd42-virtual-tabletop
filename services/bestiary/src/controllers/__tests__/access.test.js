const { isAdmin, canCreate, canWrite } = require('../access');

const gm = { sub: 'gm-1', role: 'game_master' };
const otherGm = { sub: 'gm-2', role: 'game_master' };
const player = { sub: 'p-1', role: 'user' };
const admin = { sub: 'a-1', role: 'admin' };
const ownRecord = { created_by: 'gm-1' };

describe('isAdmin', () => {
  it('is true only for the admin role', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(gm)).toBe(false);
  });
});

describe('canCreate', () => {
  it('allows only game_master and admin', () => {
    expect(canCreate(gm)).toBe(true);
    expect(canCreate(admin)).toBe(true);
    expect(canCreate(player)).toBe(false);
  });
});

describe('canWrite', () => {
  it('owner GM may write their own record', () => {
    expect(canWrite(ownRecord, gm)).toBe(true);
  });
  it('a different GM cannot write another GM\'s record', () => {
    expect(canWrite(ownRecord, otherGm)).toBe(false);
  });
  it('a player can never write', () => {
    expect(canWrite(ownRecord, player)).toBe(false);
  });
  it('admin may write any record', () => {
    expect(canWrite(ownRecord, admin)).toBe(true);
  });
});
