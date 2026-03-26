const {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  json,
  varchar,
  pgEnum,
} = require('drizzle-orm/pg-core');

const messageRoleEnum = pgEnum('message_role', ['user', 'assistant']);
const messageStatusEnum = pgEnum('message_status', ['pending', 'streaming', 'complete', 'error']);

const tiers = pgTable('tiers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  stripePriceId: varchar('stripe_price_id', { length: 255 }),
  dailyTokenBudget: integer('daily_token_budget').notNull().default(50000),
  allowedModels: json('allowed_models').notNull().default(['claude-haiku-4-5-20251001']),
  thinkingEnabled: boolean('thinking_enabled').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 100 }),
  tierId: integer('tier_id').notNull().default(1).references(function () { return tiers.id; }),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  tokensUsedToday: integer('tokens_used_today').notNull().default(0),
  tokensResetAt: timestamp('tokens_reset_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

const chats = pgTable('chats', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(function () { return users.id; }),
  title: varchar('title', { length: 255 }).default('New Chat'),
  model: varchar('model', { length: 100 }).notNull().default('claude-haiku-4-5-20251001'),
  thinkingEnabled: boolean('thinking_enabled').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  chatId: integer('chat_id').notNull().references(function () { return chats.id; }),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull().default(''),
  contentHtml: text('content_html').default(''),
  thinking: text('thinking'),
  thinkingTokens: integer('thinking_tokens').notNull().default(0),
  status: messageStatusEnum('status').notNull().default('complete'),
  error: text('error'),
  tokensIn: integer('tokens_in').notNull().default(0),
  tokensOut: integer('tokens_out').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

const usageLogs = pgTable('usage_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(function () { return users.id; }),
  chatId: integer('chat_id').notNull().references(function () { return chats.id; }),
  messageId: integer('message_id').notNull().references(function () { return messages.id; }),
  model: varchar('model', { length: 100 }).notNull(),
  tokensIn: integer('tokens_in').notNull().default(0),
  tokensOut: integer('tokens_out').notNull().default(0),
  thinkingTokens: integer('thinking_tokens').notNull().default(0),
  estimatedCostCents: integer('estimated_cost_cents').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

module.exports = {
  tiers,
  users,
  chats,
  messages,
  usageLogs,
  messageRoleEnum,
  messageStatusEnum,
};
