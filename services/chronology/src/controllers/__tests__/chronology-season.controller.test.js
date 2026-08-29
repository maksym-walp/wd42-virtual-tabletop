jest.mock('../../models/chronology.model');
jest.mock('../../models/chronology-season.model');

const ChronologyModel = require('../../models/chronology.model');
const ChronologySeasonModel = require('../../models/chronology-season.model');
const ChronologySeasonController = require('../chronology-season.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function mockReq({ params = {}, body = {}, user = { sub: 'user-1', role: 'game_master' } } = {}) {
  return { params, body, user };
}

beforeEach(() => jest.clearAllMocks());

describe('ChronologySeasonController.create', () => {
  it('returns 400 on an invalid hex color', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    const req = mockReq({
      params: { id: 'c1' },
      body: { name: 'Літо', start_month_id: 'm1', start_day: 1, color: 'not-a-color' },
    });
    const res = mockRes();

    await ChronologySeasonController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologySeasonModel.create).not.toHaveBeenCalled();
  });

  it('returns 400 when start_month_id does not belong to this calendar', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologySeasonModel.monthBelongsToCalendar.mockResolvedValue(false);
    const req = mockReq({
      params: { id: 'c1' },
      body: { name: 'Літо', start_month_id: 'other-cal-month', start_day: 1, color: '#4caf50' },
    });
    const res = mockRes();

    await ChronologySeasonController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ChronologySeasonModel.create).not.toHaveBeenCalled();
  });

  it('creates a season once validation and month ownership pass', async () => {
    ChronologyModel.findByIdRaw.mockResolvedValue({ id: 'c1' });
    ChronologySeasonModel.monthBelongsToCalendar.mockResolvedValue(true);
    ChronologySeasonModel.create.mockResolvedValue({ id: 's1' });
    const body = { name: 'Літо', start_month_id: 'm1', start_day: 1, color: '#4caf50' };
    const req = mockReq({ params: { id: 'c1' }, body });
    const res = mockRes();

    await ChronologySeasonController.create(req, res);

    expect(ChronologySeasonModel.create).toHaveBeenCalledWith('c1', body);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
