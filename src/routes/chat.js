const express = require('express');
const { getDb } = require('../services/db');
const { chats, messages, usageLogs, users } = require('../schema/index');
const { eq, desc, and, lt } = require('drizzle-orm');
const { requireAuth } = require('../middleware/auth');
const { sendMessage, isCircuitOpen } = require('../services/claude');
const { calculateCostCents, estimateTokenCost, logger, MODELS } = require('../config');

const router = express.Router();

// GET /chats — list user's chats
router.get('/chats', requireAuth, async function (req, res) {
  try {
    var db = getDb();
    var userChats = await db
      .select()
      .from(chats)
      .where(eq(chats.userId, req.session.userId))
      .orderBy(desc(chats.updatedAt))
      .limit(50);

    res.render('chat-list', {
      pageTitle: 'Chats',
      chats: userChats,
    });
  } catch (err) {
    logger.error({ err: err }, 'Failed to list chats');
    res.status(500).render('error', { message: 'Failed to load chats', status: 500, pageTitle: 'Error' });
  }
});

// POST /chat/new — create a new chat
router.post('/chat/new', requireAuth, async function (req, res) {
  try {
    var db = getDb();
    var tier = res.locals.tier;
    var defaultModel = tier && tier.allowedModels && tier.allowedModels.length > 0
      ? tier.allowedModels[0]
      : 'claude-haiku-4-5-20251001';

    var result = await db.insert(chats).values({
      userId: req.session.userId,
      title: 'New Chat',
      model: defaultModel,
      thinkingEnabled: false,
    }).returning({ id: chats.id });

    res.redirect('/chat/' + result[0].id);
  } catch (err) {
    logger.error({ err: err }, 'Failed to create chat');
    req.session.flash = { type: 'error', message: 'Failed to create chat.' };
    res.redirect('/chats');
  }
});

// GET /chat/:id — view a chat
router.get('/chat/:id', requireAuth, async function (req, res) {
  try {
    var db = getDb();
    var chatId = parseInt(req.params.id, 10);
    if (isNaN(chatId)) return res.redirect('/chats');

    var chatRows = await db.select().from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, req.session.userId)))
      .limit(1);

    if (chatRows.length === 0) {
      req.session.flash = { type: 'error', message: 'Chat not found.' };
      return res.redirect('/chats');
    }

    var chat = chatRows[0];

    // Get messages with optional pagination
    var beforeId = req.query.before ? parseInt(req.query.before, 10) : null;
    var limit = 20;

    var query = db.select().from(messages).where(eq(messages.chatId, chatId));
    if (beforeId) {
      query = db.select().from(messages)
        .where(and(eq(messages.chatId, chatId), lt(messages.id, beforeId)));
    }

    var chatMessages = await query.orderBy(desc(messages.id)).limit(limit + 1);

    var hasMore = chatMessages.length > limit;
    if (hasMore) chatMessages.pop();
    chatMessages.reverse();

    // Check if there's a pending message
    var pendingMsg = chatMessages.find(function (m) {
      return m.status === 'pending' || m.status === 'streaming';
    });

    var tier = res.locals.tier;

    res.render('chat', {
      pageTitle: chat.title,
      chat: chat,
      messages: chatMessages,
      pendingMessage: pendingMsg || null,
      metaRefresh: pendingMsg ? '3;url=/chat/' + chatId : null,
      hasMore: hasMore,
      beforeId: hasMore ? chatMessages[0].id : null,
      models: MODELS,
      tier: tier,
    });
  } catch (err) {
    logger.error({ err: err, chatId: req.params.id }, 'Failed to load chat');
    res.status(500).render('error', { message: 'Failed to load chat', status: 500, pageTitle: 'Error' });
  }
});

// POST /chat/:id — send a message
router.post('/chat/:id', requireAuth, async function (req, res) {
  var chatId = parseInt(req.params.id, 10);
  if (isNaN(chatId)) return res.redirect('/chats');

  try {
    var db = getDb();
    var content = (req.body.content || '').trim();
    if (!content) {
      req.session.flash = { type: 'error', message: 'Message cannot be empty.' };
      return res.redirect('/chat/' + chatId);
    }

    // Verify chat ownership
    var chatRows = await db.select().from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, req.session.userId)))
      .limit(1);

    if (chatRows.length === 0) {
      return res.redirect('/chats');
    }

    var chat = chatRows[0];
    var user = res.locals.user;
    var tier = res.locals.tier;

    // Check circuit breaker
    if (isCircuitOpen()) {
      req.session.flash = { type: 'error', message: 'AI service is temporarily unavailable. Please try again in 30 seconds.' };
      return res.redirect('/chat/' + chatId);
    }

    // Check token budget
    if (tier) {
      var estimatedTokens = estimateTokenCost(chat.model, content.length / 4);
      if (user.tokensUsedToday + estimatedTokens > tier.dailyTokenBudget) {
        req.session.flash = { type: 'error', message: 'Daily token budget exceeded. Upgrade your plan or wait until tomorrow.' };
        return res.redirect('/chat/' + chatId);
      }
    }

    // Insert user message
    await db.insert(messages).values({
      chatId: chatId,
      role: 'user',
      content: content,
      contentHtml: '<p>' + content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') + '</p>',
      status: 'complete',
    });

    // Insert pending assistant message
    var pendingResult = await db.insert(messages).values({
      chatId: chatId,
      role: 'assistant',
      content: '',
      contentHtml: '',
      status: 'pending',
    }).returning({ id: messages.id });

    var pendingMsgId = pendingResult[0].id;

    // Update chat title from first message
    if (chat.title === 'New Chat') {
      var newTitle = content.substring(0, 50) + (content.length > 50 ? '...' : '');
      await db.update(chats).set({ title: newTitle, updatedAt: new Date() }).where(eq(chats.id, chatId));
    } else {
      await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId));
    }

    // Get chat history for context
    var history = await db.select().from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.status, 'complete')))
      .orderBy(messages.id)
      .limit(50);

    var apiMessages = history.map(function (m) {
      return { role: m.role, content: m.content };
    });

    // Fire Claude API call asynchronously
    (async function () {
      try {
        var result = await sendMessage({
          model: chat.model,
          messages: apiMessages,
          thinkingEnabled: chat.thinkingEnabled,
        });

        await db.update(messages).set({
          content: result.content,
          contentHtml: result.contentHtml,
          thinking: result.thinking,
          thinkingTokens: result.thinkingTokens,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          status: 'complete',
        }).where(eq(messages.id, pendingMsgId));

        // Log usage
        var costCents = calculateCostCents(chat.model, result.tokensIn, result.tokensOut, result.thinkingTokens);
        await db.insert(usageLogs).values({
          userId: req.session.userId,
          chatId: chatId,
          messageId: pendingMsgId,
          model: chat.model,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          thinkingTokens: result.thinkingTokens,
          estimatedCostCents: costCents,
        });

        // Update user's token usage
        var totalTokens = result.tokensIn + result.tokensOut + result.thinkingTokens;
        await db.update(users).set({
          tokensUsedToday: user.tokensUsedToday + totalTokens,
        }).where(eq(users.id, req.session.userId));

      } catch (err) {
        logger.error({ err: err, chatId: chatId, messageId: pendingMsgId }, 'Claude API call failed');
        await db.update(messages).set({
          status: 'error',
          error: err.message || 'Failed to get response',
        }).where(eq(messages.id, pendingMsgId));
      }
    })();

    // Redirect immediately — user will see "Thinking..." with polling/meta-refresh
    res.redirect('/chat/' + chatId);
  } catch (err) {
    logger.error({ err: err }, 'Failed to send message');
    req.session.flash = { type: 'error', message: 'Failed to send message.' };
    res.redirect('/chat/' + chatId);
  }
});

// POST /chat/:id/settings — update chat model/thinking
router.post('/chat/:id/settings', requireAuth, async function (req, res) {
  var chatId = parseInt(req.params.id, 10);
  if (isNaN(chatId)) return res.redirect('/chats');

  try {
    var db = getDb();
    var tier = res.locals.tier;

    var model = req.body.model;
    var thinkingEnabled = req.body.thinking_enabled === 'on' || req.body.thinking_enabled === 'true';

    // Validate model against tier
    if (tier && tier.allowedModels && tier.allowedModels.indexOf(model) === -1) {
      req.session.flash = { type: 'error', message: 'Your plan does not include this model.' };
      return res.redirect('/chat/' + chatId);
    }

    // Validate thinking against tier
    if (thinkingEnabled && tier && !tier.thinkingEnabled) {
      thinkingEnabled = false;
    }

    await db.update(chats).set({
      model: model || 'claude-haiku-4-5-20251001',
      thinkingEnabled: thinkingEnabled,
      updatedAt: new Date(),
    }).where(and(eq(chats.id, chatId), eq(chats.userId, req.session.userId)));

    res.redirect('/chat/' + chatId);
  } catch (err) {
    logger.error({ err: err }, 'Failed to update chat settings');
    req.session.flash = { type: 'error', message: 'Failed to update settings.' };
    res.redirect('/chat/' + chatId);
  }
});

// GET /usage — daily token usage dashboard
router.get('/usage', requireAuth, function (req, res) {
  res.render('usage', {
    pageTitle: 'Usage',
  });
});

module.exports = router;
