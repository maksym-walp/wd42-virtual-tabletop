jest.mock('fs', () => ({
  promises: { mkdir: jest.fn().mockResolvedValue(undefined), writeFile: jest.fn().mockResolvedValue(undefined) },
}));

const fs = require('fs');
const MediaController = require('../media.controller');

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ body = {}, file, user = { sub: 'user-1' } } = {}) {
  return { body, file, user };
}

const pngFile = (originalname = 'photo.png') => ({
  buffer: PNG, mimetype: 'image/png', originalname,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => console.log.mockRestore());

it('rejects a request with no file', async () => {
  const res = mockRes();
  await MediaController.upload(mockReq({ body: { entity_type: 'item' } }), res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(fs.promises.writeFile).not.toHaveBeenCalled();
});

it('writes an item upload to the flat items directory and returns its url', async () => {
  const res = mockRes();
  await MediaController.upload(mockReq({ body: { entity_type: 'item' }, file: pngFile() }), res);

  expect(fs.promises.mkdir).toHaveBeenCalledWith('/uploads/items', { recursive: true, mode: 0o755 });

  const [writtenPath, buffer, opts] = fs.promises.writeFile.mock.calls[0];
  expect(writtenPath).toMatch(/^\/uploads\/items\/[0-9a-f-]{36}\.png$/);
  expect(buffer).toBe(PNG);
  expect(opts).toEqual({ mode: 0o644 });

  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json.mock.calls[0][0].url).toMatch(/^\/uploads\/items\/[0-9a-f-]{36}\.png$/);
});

it('nests a campaign-gallery upload under the campaign id', async () => {
  const res = mockRes();
  await MediaController.upload(
    mockReq({ body: { entity_type: 'campaign-gallery', entity_id: UUID }, file: pngFile() }), res
  );
  expect(fs.promises.writeFile.mock.calls[0][0]).toMatch(
    new RegExp(`^/uploads/campaigns/${UUID}/gallery/[0-9a-f-]{36}\\.png$`)
  );
});

// The filename must come from crypto + the MIME map, never from the client.
it('never uses the client-supplied originalname in the stored path', async () => {
  const res = mockRes();
  const hostile = '../../evil.php';
  await MediaController.upload(
    mockReq({ body: { entity_type: 'item' }, file: pngFile(hostile) }), res
  );
  const writtenPath = fs.promises.writeFile.mock.calls[0][0];
  expect(writtenPath).not.toContain('evil');
  expect(writtenPath).not.toContain('..');
  expect(writtenPath).toMatch(/^\/uploads\/items\/[0-9a-f-]{36}\.png$/);
});

it('gives each upload a distinct filename', async () => {
  const res = mockRes();
  await MediaController.upload(mockReq({ body: { entity_type: 'item' }, file: pngFile() }), res);
  await MediaController.upload(mockReq({ body: { entity_type: 'item' }, file: pngFile() }), res);
  const [a, b] = fs.promises.writeFile.mock.calls.map((c) => c[0]);
  expect(a).not.toBe(b);
});

it('rejects bytes that do not match the declared mime', async () => {
  const res = mockRes();
  const svg = { buffer: Buffer.from('<svg onload=alert(1)>'), mimetype: 'image/png', originalname: 'x.png' };
  await MediaController.upload(mockReq({ body: { entity_type: 'item' }, file: svg }), res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(fs.promises.writeFile).not.toHaveBeenCalled();
});

it('throws a 400 before touching disk on an invalid entity id', async () => {
  const res = mockRes();
  const req = mockReq({ body: { entity_type: 'character', entity_id: '../../etc' }, file: pngFile() });
  await expect(MediaController.upload(req, res)).rejects.toMatchObject({ statusCode: 400 });
  expect(fs.promises.mkdir).not.toHaveBeenCalled();
  expect(fs.promises.writeFile).not.toHaveBeenCalled();
});
