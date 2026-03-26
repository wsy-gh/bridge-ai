const { getDb } = require('../services/db');
const { users, tiers } = require('../schema/index');
const { eq } = require('drizzle-orm');
const { estimateTokenCost, logger } = require('../config');

async function resetTokensIfNeeded(user) {
  if (!user.tokensResetAt) return user;

  var resetAt = new Date(user.tokensResetAt);
  var now = new Date();
  var hoursSinceReset = (now - resetAt) / (1000 * 60 * 60);

  if (hoursSinceReset >= 24) {
    var db = getDb();
    await db.update(users).set({
      tokensUsedToday: 0,
      tokensResetAt: now,
    }).where(eq(users.id, user.id));

    user.tokensUsedToday = 0;
    user.tokensResetAt = now;
    logger.info({ userId: user.id }, 'Token budget reset (on-demand)');
  }

  return user;
}

async function checkTokenBudget(req, res, next) {
  if (!res.locals.user || !res.locals.tier) {
    return next();
  }

  try {
    var user = await resetTokensIfNeeded(res.locals.user);
    res.locals.user = user;

    var tier = res.locals.tier;
    var content = (req.body && req.body.content) || '';
    var estimatedInputTokens = Math.ceil(content.length / 4);
    var model = null;

    // Get model from chat if available
    if (req.params.id) {
      var db = getDb();
      var { chats } = require('../schema/index');
      var { and } = require('drizzle-orm');
      var chatRows = await db.select().from(chats)
        .where(and(eq(chats.id, parseInt(req.params.id, 10)), eq(chats.userId, user.id)))
        .limit(1);
      if (chatRows.length > 0) {
        model = chatRows[0].model;
      }
    }

    model = model || 'claude-haiku-4-5-20251001';
    var estimated = estimateTokenCost(model, estimatedInputTokens);

    if (user.tokensUsedToday + estimated > tier.dailyTokenBudget) {
      req.session.flash = {
        type: 'error',
        message: 'Daily token budget exceeded (' + user.tokensUsedToday.toLocaleString() + '/' + tier.dailyTokenBudget.toLocaleString() + '). Upgrade your plan or wait until tomorrow.',
      };
      return res.redirect(req.headers.referer || '/chats');
    }

    next();
  } catch (err) {
    logger.error({ err: err }, 'Token budget check failed');
    next(); // Allow request to proceed on error
  }
}

module.exports = { checkTokenBudget, resetTokensIfNeeded };
