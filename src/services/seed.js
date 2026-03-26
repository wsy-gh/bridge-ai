const { getDb } = require('./db');
const { tiers } = require('../schema/index');
const { DEFAULT_TIERS, logger } = require('../config');
const { eq } = require('drizzle-orm');

async function seedTiers() {
  const db = getDb();

  for (const tier of DEFAULT_TIERS) {
    const existing = await db.select().from(tiers).where(eq(tiers.name, tier.name));

    if (existing.length === 0) {
      await db.insert(tiers).values({
        name: tier.name,
        stripePriceId: tier.stripePriceId,
        dailyTokenBudget: tier.dailyTokenBudget,
        allowedModels: tier.allowedModels,
        thinkingEnabled: tier.thinkingEnabled,
      });
      logger.info({ tier: tier.name }, 'Seeded tier');
    } else {
      logger.info({ tier: tier.name }, 'Tier already exists, skipping');
    }
  }
}

if (require.main === module) {
  require('dotenv/config');
  seedTiers()
    .then(function () {
      logger.info('Seed complete');
      process.exit(0);
    })
    .catch(function (err) {
      logger.error({ err: err }, 'Seed failed');
      process.exit(1);
    });
}

module.exports = { seedTiers };
