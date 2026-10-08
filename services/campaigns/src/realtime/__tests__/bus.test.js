const bus = require('../bus');

describe('realtime bus', () => {
  it('delivers a topic only to listeners of that campaign', () => {
    const mine = jest.fn();
    const other = jest.fn();
    const offMine = bus.subscribe('c1', mine);
    const offOther = bus.subscribe('c2', other);

    bus.publish('c1', 'board');

    expect(mine).toHaveBeenCalledWith('board');
    expect(other).not.toHaveBeenCalled();
    offMine();
    offOther();
  });

  it('stops delivering after unsubscribe', () => {
    const listener = jest.fn();
    const off = bus.subscribe('c1', listener);
    expect(bus.listenerCount('c1')).toBe(1);

    off();
    bus.publish('c1', 'board');

    expect(listener).not.toHaveBeenCalled();
    expect(bus.listenerCount('c1')).toBe(0);
  });

  it('marks the Screen topic as manager-only', () => {
    expect(bus.MANAGER_ONLY_TOPICS.has('screen')).toBe(true);
    expect(bus.MANAGER_ONLY_TOPICS.has('board')).toBe(false);
  });
});
