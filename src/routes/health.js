const express = require('express');

function createHealthRouter(deps) {
  var pingDb = deps && deps.pingDb ? deps.pingDb : require('../services/db').pingDb;
  var router = express.Router();

  router.get('/health', async function (req, res) {
    var dbOk = await pingDb();

    var redisOk = false;
    if (req.app.locals.redis) {
      try {
        await req.app.locals.redis.ping();
        redisOk = true;
      } catch (err) {
        redisOk = false;
      }
    } else {
      redisOk = true;
    }

    var status = dbOk && redisOk ? 'ok' : 'degraded';
    var httpStatus = status === 'ok' ? 200 : 503;

    res.status(httpStatus).json({
      status: status,
      db: dbOk,
      redis: redisOk,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

// Default export for server.js (uses real db)
module.exports = createHealthRouter();
module.exports.createHealthRouter = createHealthRouter;
