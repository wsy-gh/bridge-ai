const request = require('supertest');
const { createTestApp } = require('../helpers/createApp');

describe('Auth middleware', function () {
  describe('requireAuth', function () {
    it('should redirect unauthenticated users to login', async function () {
      var { requireAuth } = require('../../src/middleware/auth');
      var app = createTestApp({
        middleware: [requireAuth],
        routes: [{
          router: (function () {
            var r = require('express').Router();
            r.get('/protected', function (req, res) { res.send('OK'); });
            return r;
          })(),
        }],
      });

      var res = await request(app).get('/protected');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/auth/login');
    });
  });
});

describe('Auth routes', function () {
  it('GET /auth/login should render login page', async function () {
    var authRouter = require('../../src/routes/auth');
    var app = createTestApp({
      routes: [{ path: '/auth', router: authRouter }],
    });

    var res = await request(app).get('/auth/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Login');
    expect(res.text).toContain('email');
    expect(res.text).toContain('password');
  });

  it('GET /auth/register should render register page', async function () {
    var authRouter = require('../../src/routes/auth');
    var app = createTestApp({
      routes: [{ path: '/auth', router: authRouter }],
    });

    var res = await request(app).get('/auth/register');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Create Account');
    expect(res.text).toContain('display_name');
  });

  it('POST /auth/login should reject empty credentials', async function () {
    var authRouter = require('../../src/routes/auth');
    var app = createTestApp({
      routes: [{ path: '/auth', router: authRouter }],
    });

    var res = await request(app)
      .post('/auth/login')
      .type('form')
      .send({ email: '', password: '' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/auth/login');
  });

  it('POST /auth/register should reject short password', async function () {
    var authRouter = require('../../src/routes/auth');
    var app = createTestApp({
      routes: [{ path: '/auth', router: authRouter }],
    });

    var res = await request(app)
      .post('/auth/register')
      .type('form')
      .send({
        email: 'test@test.com',
        display_name: 'Test',
        password: 'short',
        confirm_password: 'short',
      });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/auth/register');
  });

  it('POST /auth/register should reject mismatched passwords', async function () {
    var authRouter = require('../../src/routes/auth');
    var app = createTestApp({
      routes: [{ path: '/auth', router: authRouter }],
    });

    var res = await request(app)
      .post('/auth/register')
      .type('form')
      .send({
        email: 'test@test.com',
        display_name: 'Test',
        password: 'password123',
        confirm_password: 'different123',
      });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/auth/register');
  });
});
