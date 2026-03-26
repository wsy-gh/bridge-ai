const request = require('supertest');
const express = require('express');
const { createHealthRouter } = require('../../src/routes/health');

function createHealthApp(dbOk, redisClient) {
  var router = createHealthRouter({
    pingDb: vi.fn().mockResolvedValue(dbOk),
  });
  var app = express();
  if (redisClient) app.locals.redis = redisClient;
  app.use('/', router);
  return app;
}

describe('GET /health', function () {
  it('should return 200 when db is healthy and no redis', async function () {
    var app = createHealthApp(true, null);
    var res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe(true);
    expect(res.body.redis).toBe(true);
    expect(res.body.timestamp).toBeDefined();
  });

  it('should return 503 when db is down', async function () {
    var app = createHealthApp(false, null);
    var res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.db).toBe(false);
  });

  it('should check redis when available', async function () {
    var mockRedis = { ping: vi.fn().mockResolvedValue('PONG') };
    var app = createHealthApp(true, mockRedis);
    var res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.redis).toBe(true);
    expect(mockRedis.ping).toHaveBeenCalled();
  });

  it('should report degraded when redis fails', async function () {
    var mockRedis = { ping: vi.fn().mockRejectedValue(new Error('fail')) };
    var app = createHealthApp(true, mockRedis);
    var res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.redis).toBe(false);
  });
});
