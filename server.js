const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const pinoHttp = require('pino-http');
const { validateEnv, logger } = require('./src/config');

// Validate environment
const config = validateEnv();

// Sentry (optional)
if (config.sentryDsn) {
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.nodeEnv,
      tracesSampleRate: config.isProduction ? 0.1 : 1.0,
    });
    logger.info('Sentry initialized');
  } catch (err) {
    logger.warn({ err: err }, 'Sentry initialization failed');
  }
}

const app = express();

// Trust proxy for Railway/Render
app.set('trust proxy', 1);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Helmet security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'https://res.cloudinary.com'],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
    },
  },
}));

// Logging
app.use(pinoHttp({
  logger: logger,
  autoLogging: { ignore: function (req) { return req.url === '/health'; } },
}));

// Body parsing — raw body for Stripe webhooks, then JSON/form parsing
app.use('/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

// Session setup
var sessionStore;
if (config.upstashRedisUrl && config.upstashRedisToken) {
  try {
    const Redis = require('ioredis');
    const RedisStore = require('connect-redis').default;
    const redis = new Redis(config.upstashRedisUrl, {
      password: config.upstashRedisToken,
      tls: config.upstashRedisUrl.startsWith('rediss://') ? {} : undefined,
    });
    sessionStore = new RedisStore({ client: redis });
    app.locals.redis = redis;
    logger.info('Redis session store initialized');
  } catch (err) {
    logger.warn({ err: err }, 'Redis init failed, falling back to MemoryStore');
  }
}

app.use(session({
  store: sessionStore || undefined,
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.isProduction,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// Flash messages middleware
app.use(function (req, res, next) {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.user = null;
  res.locals.tier = null;
  next();
});

// Kindle UA detection
const { kindleDetect } = require('./src/middleware/kindle');
app.use(kindleDetect);

// Load user data into res.locals for all routes
const { loadUser } = require('./src/middleware/auth');
app.use(loadUser);

// Routes
app.use('/', require('./src/routes/health'));
app.use('/auth', require('./src/routes/auth'));

// Routes added as they are created (chat, api, billing)
var routeFiles = ['./src/routes/chat', './src/routes/api', './src/routes/billing'];
routeFiles.forEach(function (routeFile) {
  try {
    var prefix = routeFile.includes('chat') ? '/' : routeFile.includes('api') ? '/api' : '/billing';
    app.use(prefix, require(routeFile));
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') throw e;
  }
});

// Home redirect
app.get('/', function (req, res) {
  if (req.session && req.session.userId) {
    res.redirect('/chats');
  } else {
    res.redirect('/auth/login');
  }
});

// 404
app.use(function (req, res) {
  res.status(404).render('error', {
    message: 'Page not found',
    status: 404,
    pageTitle: 'Not Found',
  });
});

// Error handler
app.use(function (err, req, res, _next) {
  logger.error({ err: err, url: req.url }, 'Unhandled error');

  if (config.sentryDsn) {
    try { require('@sentry/node').captureException(err); } catch (e) { /* ignore */ }
  }

  res.status(err.status || 500).render('error', {
    message: config.isProduction ? 'Something went wrong' : err.message,
    status: err.status || 500,
    pageTitle: 'Error',
  });
});

// Start server
const server = app.listen(config.port, function () {
  logger.info({ port: config.port, env: config.nodeEnv }, 'Bridge AI server started');
});

// Graceful shutdown
function gracefulShutdown(signal) {
  logger.info({ signal: signal }, 'Received shutdown signal');
  server.close(function () {
    logger.info('HTTP server closed');
    if (app.locals.redis) {
      app.locals.redis.quit().then(function () {
        logger.info('Redis connection closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });

  // Force exit after 30s
  setTimeout(function () {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', function () { gracefulShutdown('SIGTERM'); });
process.on('SIGINT', function () { gracefulShutdown('SIGINT'); });

module.exports = app;
