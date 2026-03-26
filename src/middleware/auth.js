const { getDb } = require('../services/db');
const { users, tiers } = require('../schema/index');
const { eq } = require('drizzle-orm');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    req.session.flash = { type: 'error', message: 'Please log in to continue.' };
    return res.redirect('/auth/login');
  }
  next();
}

async function loadUser(req, res, next) {
  if (req.session && req.session.userId) {
    try {
      var db = getDb();
      var rows = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (rows.length > 0) {
        var user = rows[0];
        var tierRows = await db
          .select()
          .from(tiers)
          .where(eq(tiers.id, user.tierId))
          .limit(1);

        res.locals.user = user;
        res.locals.tier = tierRows.length > 0 ? tierRows[0] : null;
      } else {
        // User no longer exists, clear session
        delete req.session.userId;
      }
    } catch (err) {
      // DB error — continue without user data
      req.log && req.log.error({ err: err }, 'Failed to load user');
    }
  }
  next();
}

module.exports = { requireAuth, loadUser };
