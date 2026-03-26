const Anthropic = require('@anthropic-ai/sdk');
const CircuitBreaker = require('opossum');
const { logger } = require('../config');
const { renderMarkdown } = require('./markdown');

var client = null;

function getClient() {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return client;
}

async function callClaude(params) {
  var anthropic = getClient();
  var model = params.model;
  var chatMessages = params.messages;
  var thinkingEnabled = params.thinkingEnabled || false;

  var startTime = Date.now();

  var apiParams = {
    model: model,
    max_tokens: 4096,
    messages: chatMessages,
  };

  if (thinkingEnabled) {
    apiParams.thinking = {
      type: 'enabled',
      budget_tokens: 2048,
    };
  }

  var response = await anthropic.messages.create(apiParams);

  var latency = Date.now() - startTime;
  var content = '';
  var thinking = '';
  var thinkingTokens = 0;

  if (response.content) {
    response.content.forEach(function (block) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'thinking') {
        thinking += block.thinking;
      }
    });
  }

  var tokensIn = response.usage ? response.usage.input_tokens : 0;
  var tokensOut = response.usage ? response.usage.output_tokens : 0;

  // Thinking tokens come from cache_creation or separate field
  if (response.usage && response.usage.cache_creation_input_tokens) {
    thinkingTokens = response.usage.cache_creation_input_tokens;
  }

  logger.info({
    model: model,
    tokensIn: tokensIn,
    tokensOut: tokensOut,
    thinkingTokens: thinkingTokens,
    latencyMs: latency,
  }, 'Claude API call complete');

  return {
    content: content,
    contentHtml: renderMarkdown(content),
    thinking: thinking || null,
    thinkingTokens: thinkingTokens,
    tokensIn: tokensIn,
    tokensOut: tokensOut,
  };
}

// Circuit breaker wrapping the Claude API call
var breaker = new CircuitBreaker(callClaude, {
  timeout: 90000, // 90s (Claude can be slow with thinking)
  errorThresholdPercentage: 50,
  resetTimeout: 30000, // 30s cooldown
  volumeThreshold: 3,
  name: 'claude-api',
});

breaker.on('open', function () {
  logger.warn('Claude API circuit breaker OPENED');
});

breaker.on('halfOpen', function () {
  logger.info('Claude API circuit breaker half-open, testing...');
});

breaker.on('close', function () {
  logger.info('Claude API circuit breaker CLOSED');
});

async function sendMessage(params) {
  return breaker.fire(params);
}

function isCircuitOpen() {
  return breaker.opened;
}

module.exports = { sendMessage, isCircuitOpen, callClaude };
