jest.mock('../../models/campaign.model');
jest.mock('../../models/campaign-character.model');

const { EventEmitter } = require('events');
const CampaignModel = require('../../models/campaign.model');
const CampaignCharacterModel = require('../../models/campaign-character.model');
const EventsController = require('../events.controller');
const bus = require('../../realtime/bus');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    set: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
  };
}

function mockReq(user) {
  const req = new EventEmitter();
  req.params = { id: 'c1' };
  req.user = user;
  return req;
}

const written = (res) => res.write.mock.calls.map(([chunk]) => chunk);

beforeEach(() => {
  jest.clearAllMocks();
  CampaignModel.findById.mockResolvedValue({ id: 'c1', gm_id: 'gm-1' });
});

describe('EventsController.stream', () => {
  it('403s for a user who is neither manager nor member', async () => {
    CampaignCharacterModel.isMember.mockResolvedValue(false);
    const res = mockRes();

    await EventsController.stream(mockReq({ sub: 'stranger' }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.flushHeaders).not.toHaveBeenCalled();
  });

  it('opens an unbuffered event stream and forwards board topics to a player', async () => {
    CampaignCharacterModel.isMember.mockResolvedValue(true);
    const req = mockReq({ sub: 'player-1' });
    const res = mockRes();

    await EventsController.stream(req, res);
    bus.publish('c1', 'board');
    bus.publish('c1', 'screen');

    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      'Content-Type': expect.stringContaining('text/event-stream'),
      'X-Accel-Buffering': 'no',
    }));
    expect(res.flushHeaders).toHaveBeenCalled();
    expect(written(res)).toContain('data: {"topic":"board"}\n\n');
    expect(written(res)).not.toContain('data: {"topic":"screen"}\n\n');

    req.emit('close');
  });

  it('forwards Screen topics to the GM', async () => {
    const req = mockReq({ sub: 'gm-1' });
    const res = mockRes();

    await EventsController.stream(req, res);
    bus.publish('c1', 'screen');

    expect(written(res)).toContain('data: {"topic":"screen"}\n\n');
    req.emit('close');
  });

  it('unsubscribes and stops the heartbeat when the client disconnects', async () => {
    jest.useFakeTimers();
    const req = mockReq({ sub: 'gm-1' });
    const res = mockRes();

    await EventsController.stream(req, res);
    expect(bus.listenerCount('c1')).toBe(1);

    jest.advanceTimersByTime(25000);
    expect(written(res)).toContain(': ping\n\n');

    req.emit('close');
    const before = res.write.mock.calls.length;
    jest.advanceTimersByTime(60000);
    bus.publish('c1', 'board');

    expect(bus.listenerCount('c1')).toBe(0);
    expect(res.write.mock.calls.length).toBe(before);
    jest.useRealTimers();
  });
});
