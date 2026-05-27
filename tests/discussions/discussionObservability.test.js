const discussionObservability = require('../../services/discussionObservability.service');

describe('discussionObservability.service', () => {
  const spy = jest.spyOn(console, 'info').mockImplementation(() => {});

  afterEach(() => {
    spy.mockClear();
  });

  afterAll(() => {
    spy.mockRestore();
  });

  it('emits structured JSON for route latency', () => {
    discussionObservability.routeLatency({
      prefix: 'threads',
      method: 'GET',
      path: '/api/threads/:id',
      statusCode: 200,
      durationMs: 12,
      actorRole: 'student',
    });
    expect(spy).toHaveBeenCalled();
    const line = spy.mock.calls.find((c) => String(c[0]).includes('discussion_route_latency'))?.[0];
    expect(line).toBeTruthy();
    const payload = JSON.parse(line);
    expect(payload.event).toBe('metric.discussion_route_latency');
    expect(payload.durationMs).toBe(12);
  });
});
