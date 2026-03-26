const express = require('express');
const { getDb } = require('../services/db');
const { messages, chats } = require('../schema/index');
const { eq, and } = require('drizzle-orm');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/chat/:chatId/status/:messageId
router.get('/chat/:chatId/status/:messageId', requireAuth, async function (req, res) {
  try {
    var db = getDb();
    var chatId = parseInt(req.params.chatId, 10);
    var messageId = parseInt(req.params.messageId, 10);

    if (isNaN(chatId) || isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }

    // Verify chat ownership
    var chatRows = await db.select().from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, req.session.userId)))
      .limit(1);

    if (chatRows.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Get message
    var msgRows = await db.select().from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.chatId, chatId)))
      .limit(1);

    if (msgRows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    var msg = msgRows[0];

    var result = {
      status: msg.status,
    };

    if (msg.status === 'complete') {
      result.html = msg.contentHtml;
      if (msg.thinking) {
        result.thinking = msg.thinking;
        result.thinkingTokens = msg.thinkingTokens;
      }
      result.tokensIn = msg.tokensIn;
      result.tokensOut = msg.tokensOut;
    } else if (msg.status === 'error') {
      result.error = msg.error || 'An error occurred';
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/internal/reset-tokens — called by QStash daily
router.post('/internal/reset-tokens', async function (req, res) {
  try {
    // TODO: Verify QStash signature in production
    var db = getDb();
    var { users } = require('../schema/index');

    await db.update(users).set({
      tokensUsedToday: 0,
      tokensResetAt: new Date(),
    });

    res.json({ status: 'ok', message: 'All token budgets reset' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset tokens' });
  }
});

module.exports = router;
