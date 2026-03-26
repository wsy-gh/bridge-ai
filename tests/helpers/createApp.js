const path = require('path');
const express = require('express');
const session = require('express-session');

function createTestApp(options) {
  options = options || {};
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../../views'));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, '../../public')));

  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
  }));

  // Flash messages
  app.use(function (req, res, next) {
    res.locals.flash = req.session.flash || null;
    delete req.session.flash;
    res.locals.user = null;
    res.locals.tier = null;
    next();
  });

  // Allow injecting middleware
  if (options.middleware) {
    options.middleware.forEach(function (mw) { app.use(mw); });
  }

  // Mount routes
  if (options.routes) {
    options.routes.forEach(function (r) {
      app.use(r.path || '/', r.router);
    });
  }

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
    res.status(err.status || 500).render('error', {
      message: err.message,
      status: err.status || 500,
      pageTitle: 'Error',
    });
  });

  return app;
}

module.exports = { createTestApp };
