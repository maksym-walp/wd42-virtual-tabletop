jest.mock('../../models/backup.model');

const AdmZip = require('adm-zip');
const BackupModel = require('../../models/backup.model');
const BackupController = require('../backup.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn(), set: jest.fn() };
}
const upload = (originalname, content) => ({ originalname, buffer: Buffer.from(content) });

function makeZip(files) {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) zip.addFile(name, Buffer.from(content));
  return zip.toBuffer();
}

const manifest = (migrations = ['01.sql']) => JSON.stringify({ format: 'walp-backup', version: 1, migrations });

beforeEach(() => {
  jest.clearAllMocks();
  BackupModel.MIGRATIONS_TABLE = 'public.schema_migrations';
  BackupModel.currentState.mockResolvedValue({
    tables: ['auth.users', 'admin.site_configs', 'public.schema_migrations'],
    migrations: ['01.sql'],
  });
  BackupModel.restore.mockResolvedValue([]);
});

describe('BackupController.download', () => {
  it('sends a zip with manifest and one JSON per table', async () => {
    BackupModel.dumpAll.mockResolvedValue({
      tables: [{ key: 'auth.users', rowCount: 1, json: '[{"id":1}]' }],
      migrations: ['01.sql'],
    });
    const res = mockRes();
    await BackupController.download({ user: { username: 'root' } }, res);

    const zip = new AdmZip(res.send.mock.calls[0][0]);
    const m = JSON.parse(zip.readAsText('manifest.json'));
    expect(m).toMatchObject({ format: 'walp-backup', created_by: 'root', tables: { 'auth.users': 1 } });
    expect(zip.readAsText('data/auth.users.json')).toBe('[{"id":1}]');
  });
});

describe('BackupController.restore', () => {
  it('400 without files', async () => {
    await expect(BackupController.restore({ files: [] }, mockRes())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('full archive clears every table except migrations', async () => {
    const zip = makeZip({
      'manifest.json': manifest(),
      'data/auth.users.json': '[]',
      'data/public.schema_migrations.json': '[]',
    });
    const res = mockRes();
    await BackupController.restore({ files: [upload('b.zip', zip)] }, res);

    expect(BackupModel.restore).toHaveBeenCalledWith(
      [{ key: 'auth.users', json: '[]' }],
      ['auth.users', 'admin.site_configs']
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mode: 'full', cleared: ['admin.site_configs'] }));
  });

  it('separate JSON files replace only their tables and skip unknown ones', async () => {
    const res = mockRes();
    await BackupController.restore({
      files: [upload('auth.users.json', '[]'), upload('nope.table.json', '[]')],
    }, res);

    expect(BackupModel.restore).toHaveBeenCalledWith([{ key: 'auth.users', json: '[]' }], ['auth.users']);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'partial',
      skipped: [expect.objectContaining({ file: 'nope.table.json' })],
    }));
  });

  it('409 when the backup has migrations the DB lacks', async () => {
    const zip = makeZip({ 'manifest.json': manifest(['01.sql', '02.sql']), 'auth.users.json': '[]' });
    await expect(BackupController.restore({ files: [upload('b.zip', zip)] }, mockRes()))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(BackupModel.restore).not.toHaveBeenCalled();
  });

  it('400 for a foreign manifest', async () => {
    const zip = makeZip({ 'manifest.json': '{"format":"other"}', 'auth.users.json': '[]' });
    await expect(BackupController.restore({ files: [upload('b.zip', zip)] }, mockRes()))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
