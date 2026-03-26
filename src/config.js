const pino = require('pino');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const REQUIRED_ENV = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'ANTHROPIC_API_KEY',
];

const OPTIONAL_ENV = [
  'PORT',
  'NODE_ENV',
  'UPSTASH_REDIS_URL',
  'UPSTASH_REDIS_TOKEN',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'CLOUDINARY_URL',
  'SENTRY_DSN',
  'RESEND_API_KEY',
  'QSTASH_TOKEN',
  'QSTASH_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
];

function validateEnv() {
  const missing = REQUIRED_ENV.filter(function (key) {
    return !process.env[key];
  });

  if (missing.length > 0) {
    logger.fatal({ missing: missing }, 'Missing required environment variables');
    process.exit(1);
  }

  const present = OPTIONAL_ENV.filter(function (key) {
    return !!process.env[key];
  });
  const absent = OPTIONAL_ENV.filter(function (key) {
    return !process.env[key];
  });

  if (absent.length > 0) {
    logger.warn({ absent: absent }, 'Optional environment variables not set — some features disabled');
  }

  return {
    port: parseInt(process.env.PORT, 10) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL,
    sessionSecret: process.env.SESSION_SECRET,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    upstashRedisUrl: process.env.UPSTASH_REDIS_URL,
    upstashRedisToken: process.env.UPSTASH_REDIS_TOKEN,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    cloudinaryUrl: process.env.CLOUDINARY_URL,
    sentryDsn: process.env.SENTRY_DSN,
    resendApiKey: process.env.RESEND_API_KEY,
    qstashToken: process.env.QSTASH_TOKEN,
    qstashSigningKey: process.env.QSTASH_SIGNING_KEY,
    qstashNextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    isProduction: process.env.NODE_ENV === 'production',
  };
}

const MODELS = {
  'claude-haiku-4-5-20251001': {
    id: 'claude-haiku-4-5-20251001',
    name: 'Haiku',
    inputCostPer1k: 0.001,
    outputCostPer1k: 0.005,
    avgOutputTokens: 500,
  },
  'claude-sonnet-4-5-20241022': {
    id: 'claude-sonnet-4-5-20241022',
    name: 'Sonnet',
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    avgOutputTokens: 800,
  },
  'claude-opus-4-5-20250514': {
    id: 'claude-opus-4-5-20250514',
    name: 'Opus',
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
    avgOutputTokens: 1000,
  },
};

const DEFAULT_TIERS = [
  {
    name: 'free',
    stripePriceId: null,
    dailyTokenBudget: 50000,
    allowedModels: ['claude-haiku-4-5-20251001'],
    thinkingEnabled: false,
  },
  {
    name: 'basic',
    stripePriceId: null,
    dailyTokenBudget: 200000,
    allowedModels: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20241022'],
    thinkingEnabled: false,
  },
  {
    name: 'pro',
    stripePriceId: null,
    dailyTokenBudget: 500000,
    allowedModels: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20241022', 'claude-opus-4-5-20250514'],
    thinkingEnabled: true,
  },
  {
    name: 'power',
    stripePriceId: null,
    dailyTokenBudget: 2000000,
    allowedModels: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20241022', 'claude-opus-4-5-20250514'],
    thinkingEnabled: true,
  },
];

function estimateTokenCost(model, inputTokens) {
  const modelInfo = MODELS[model];
  if (!modelInfo) return Infinity;
  return inputTokens + modelInfo.avgOutputTokens;
}

function calculateCostCents(model, tokensIn, tokensOut, thinkingTokens) {
  const modelInfo = MODELS[model];
  if (!modelInfo) return 0;
  var inputCost = (tokensIn / 1000) * modelInfo.inputCostPer1k;
  var outputCost = (tokensOut / 1000) * modelInfo.outputCostPer1k;
  var thinkingCost = (thinkingTokens / 1000) * modelInfo.outputCostPer1k;
  return Math.round((inputCost + outputCost + thinkingCost) * 100);
}

module.exports = {
  validateEnv,
  MODELS,
  DEFAULT_TIERS,
  estimateTokenCost,
  calculateCostCents,
  logger,
};
