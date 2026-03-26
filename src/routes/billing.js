const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../services/db');
const { users, tiers } = require('../schema/index');
const { eq } = require('drizzle-orm');
const { logger } = require('../config');

const router = express.Router();

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// GET /billing — show billing page
router.get('/', requireAuth, async function (req, res) {
  try {
    var db = getDb();
    var allTiers = await db.select().from(tiers).orderBy(tiers.id);
    var user = res.locals.user;
    var currentTier = res.locals.tier;

    res.render('billing', {
      pageTitle: 'Plan',
      tiers: allTiers,
      currentTier: currentTier,
      user: user,
      stripeEnabled: !!process.env.STRIPE_SECRET_KEY,
    });
  } catch (err) {
    logger.error({ err: err }, 'Failed to load billing page');
    res.status(500).render('error', { message: 'Failed to load billing', status: 500, pageTitle: 'Error' });
  }
});

// POST /billing/checkout — create Stripe Checkout session
router.post('/checkout', requireAuth, async function (req, res) {
  try {
    var stripe = getStripe();
    if (!stripe) {
      req.session.flash = { type: 'error', message: 'Billing is not configured.' };
      return res.redirect('/billing');
    }

    var tierId = parseInt(req.body.tier_id, 10);
    var db = getDb();
    var tierRows = await db.select().from(tiers).where(eq(tiers.id, tierId)).limit(1);

    if (tierRows.length === 0 || !tierRows[0].stripePriceId) {
      req.session.flash = { type: 'error', message: 'Invalid plan selected.' };
      return res.redirect('/billing');
    }

    var user = res.locals.user;
    var baseUrl = req.protocol + '://' + req.get('host');

    var sessionParams = {
      mode: 'subscription',
      line_items: [{ price: tierRows[0].stripePriceId, quantity: 1 }],
      success_url: baseUrl + '/billing?success=1',
      cancel_url: baseUrl + '/billing?canceled=1',
    };

    // Link to existing Stripe customer or create new
    if (user.stripeCustomerId) {
      sessionParams.customer = user.stripeCustomerId;
    } else {
      sessionParams.customer_email = user.email;
    }

    var session = await stripe.checkout.sessions.create(sessionParams);
    res.redirect(303, session.url);
  } catch (err) {
    logger.error({ err: err }, 'Stripe checkout failed');
    req.session.flash = { type: 'error', message: 'Failed to start checkout.' };
    res.redirect('/billing');
  }
});

// POST /billing/portal — redirect to Stripe Customer Portal
router.post('/portal', requireAuth, async function (req, res) {
  try {
    var stripe = getStripe();
    if (!stripe) {
      req.session.flash = { type: 'error', message: 'Billing is not configured.' };
      return res.redirect('/billing');
    }

    var user = res.locals.user;
    if (!user.stripeCustomerId) {
      req.session.flash = { type: 'error', message: 'No subscription to manage.' };
      return res.redirect('/billing');
    }

    var baseUrl = req.protocol + '://' + req.get('host');
    var session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: baseUrl + '/billing',
    });

    res.redirect(303, session.url);
  } catch (err) {
    logger.error({ err: err }, 'Stripe portal failed');
    req.session.flash = { type: 'error', message: 'Failed to open subscription portal.' };
    res.redirect('/billing');
  }
});

// POST /billing/webhook — Stripe webhook handler
router.post('/webhook', async function (req, res) {
  var stripe = getStripe();
  if (!stripe) return res.status(400).send('Billing not configured');

  var sig = req.headers['stripe-signature'];
  var webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  var event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.warn({ err: err }, 'Stripe webhook signature verification failed');
    return res.status(400).send('Webhook signature verification failed');
  }

  try {
    var db = getDb();

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        var subscription = event.data.object;
        var customerId = subscription.customer;
        var priceId = subscription.items.data[0].price.id;

        // Find the tier matching this price
        var tierRows = await db.select().from(tiers).where(eq(tiers.stripePriceId, priceId)).limit(1);
        if (tierRows.length > 0) {
          await db.update(users).set({
            tierId: tierRows[0].id,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
          }).where(eq(users.stripeCustomerId, customerId));

          logger.info({ customerId: customerId, tier: tierRows[0].name }, 'User tier updated via webhook');
        }
        break;
      }

      case 'customer.subscription.deleted': {
        var deletedSub = event.data.object;
        var deletedCustomerId = deletedSub.customer;

        // Revert to free tier (id=1)
        await db.update(users).set({
          tierId: 1,
          stripeSubscriptionId: null,
        }).where(eq(users.stripeCustomerId, deletedCustomerId));

        logger.info({ customerId: deletedCustomerId }, 'User reverted to free tier');
        break;
      }

      case 'checkout.session.completed': {
        var session = event.data.object;
        if (session.customer_email) {
          // Link Stripe customer ID to user
          await db.update(users).set({
            stripeCustomerId: session.customer,
          }).where(eq(users.email, session.customer_email));
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    logger.error({ err: err, eventType: event.type }, 'Webhook processing failed');
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
