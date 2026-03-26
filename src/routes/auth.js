const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../services/db');
const { users } = require('../schema/index');
const { eq } = require('drizzle-orm');
const { logger } = require('../config');

const router = express.Router();

const BCRYPT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limiting for login (basic in-memory, upgraded to Upstash in rateLimit.js)
var loginAttempts = {};
function checkLoginRate(ip) {
  var now = Date.now();
  var key = 'login:' + ip;
  if (!loginAttempts[key]) {
    loginAttempts[key] = { count: 0, resetAt: now + 15 * 60 * 1000 };
  }
  if (now > loginAttempts[key].resetAt) {
    loginAttempts[key] = { count: 0, resetAt: now + 15 * 60 * 1000 };
  }
  loginAttempts[key].count++;
  return loginAttempts[key].count <= 5;
}

// GET /auth/login
router.get('/login', function (req, res) {
  if (req.session && req.session.userId) {
    return res.redirect('/chats');
  }
  res.render('login', { pageTitle: 'Login' });
});

// POST /auth/login
router.post('/login', async function (req, res) {
  try {
    var email = (req.body.email || '').trim().toLowerCase();
    var password = req.body.password || '';

    // Rate limit check
    var ip = req.ip || req.connection.remoteAddress;
    if (!checkLoginRate(ip)) {
      req.session.flash = { type: 'error', message: 'Too many login attempts. Try again in 15 minutes.' };
      return res.redirect('/auth/login');
    }

    if (!email || !password) {
      req.session.flash = { type: 'error', message: 'Email and password are required.' };
      return res.redirect('/auth/login');
    }

    var db = getDb();
    var rows = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (rows.length === 0) {
      req.session.flash = { type: 'error', message: 'Invalid email or password.' };
      return res.redirect('/auth/login');
    }

    var user = rows[0];
    var match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      req.session.flash = { type: 'error', message: 'Invalid email or password.' };
      return res.redirect('/auth/login');
    }

    req.session.userId = user.id;
    logger.info({ userId: user.id }, 'User logged in');
    res.redirect('/chats');
  } catch (err) {
    logger.error({ err: err }, 'Login error');
    req.session.flash = { type: 'error', message: 'Login failed. Please try again.' };
    res.redirect('/auth/login');
  }
});

// GET /auth/register
router.get('/register', function (req, res) {
  if (req.session && req.session.userId) {
    return res.redirect('/chats');
  }
  res.render('register', { pageTitle: 'Register' });
});

// POST /auth/register
router.post('/register', async function (req, res) {
  try {
    var email = (req.body.email || '').trim().toLowerCase();
    var displayName = (req.body.display_name || '').trim();
    var password = req.body.password || '';
    var confirmPassword = req.body.confirm_password || '';

    // Validation
    if (!email || !password || !displayName) {
      req.session.flash = { type: 'error', message: 'All fields are required.' };
      return res.redirect('/auth/register');
    }

    if (!EMAIL_REGEX.test(email)) {
      req.session.flash = { type: 'error', message: 'Please enter a valid email.' };
      return res.redirect('/auth/register');
    }

    if (password.length < 8) {
      req.session.flash = { type: 'error', message: 'Password must be at least 8 characters.' };
      return res.redirect('/auth/register');
    }

    if (password !== confirmPassword) {
      req.session.flash = { type: 'error', message: 'Passwords do not match.' };
      return res.redirect('/auth/register');
    }

    var db = getDb();

    // Check existing user
    var existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      req.session.flash = { type: 'error', message: 'An account with this email already exists.' };
      return res.redirect('/auth/register');
    }

    var passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    var result = await db.insert(users).values({
      email: email,
      passwordHash: passwordHash,
      displayName: displayName,
      tierId: 1, // Free tier
      tokensUsedToday: 0,
      tokensResetAt: new Date(),
    }).returning({ id: users.id });

    req.session.userId = result[0].id;
    logger.info({ userId: result[0].id, email: email }, 'User registered');
    res.redirect('/chats');
  } catch (err) {
    logger.error({ err: err }, 'Registration error');
    req.session.flash = { type: 'error', message: 'Registration failed. Please try again.' };
    res.redirect('/auth/register');
  }
});

// POST /auth/logout
router.post('/logout', function (req, res) {
  req.session.destroy(function () {
    res.redirect('/auth/login');
  });
});

module.exports = router;
