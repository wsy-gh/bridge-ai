const { MODELS, DEFAULT_TIERS, estimateTokenCost, calculateCostCents } = require('../../src/config');

describe('config', function () {
  describe('MODELS', function () {
    it('should define haiku, sonnet, and opus', function () {
      expect(MODELS['claude-haiku-4-5-20251001']).toBeDefined();
      expect(MODELS['claude-sonnet-4-5-20241022']).toBeDefined();
      expect(MODELS['claude-opus-4-5-20250514']).toBeDefined();
    });

    it('should have cost data for each model', function () {
      Object.values(MODELS).forEach(function (model) {
        expect(model.inputCostPer1k).toBeGreaterThan(0);
        expect(model.outputCostPer1k).toBeGreaterThan(0);
        expect(model.avgOutputTokens).toBeGreaterThan(0);
      });
    });
  });

  describe('DEFAULT_TIERS', function () {
    it('should define 4 tiers', function () {
      expect(DEFAULT_TIERS).toHaveLength(4);
      expect(DEFAULT_TIERS.map(function (t) { return t.name; })).toEqual(['free', 'basic', 'pro', 'power']);
    });

    it('free tier should only allow haiku', function () {
      var free = DEFAULT_TIERS[0];
      expect(free.allowedModels).toEqual(['claude-haiku-4-5-20251001']);
      expect(free.thinkingEnabled).toBe(false);
      expect(free.dailyTokenBudget).toBe(50000);
    });

    it('power tier should allow all models with thinking', function () {
      var power = DEFAULT_TIERS[3];
      expect(power.allowedModels).toHaveLength(3);
      expect(power.thinkingEnabled).toBe(true);
      expect(power.dailyTokenBudget).toBe(2000000);
    });
  });

  describe('estimateTokenCost', function () {
    it('should estimate tokens for known model', function () {
      var cost = estimateTokenCost('claude-haiku-4-5-20251001', 100);
      expect(cost).toBe(100 + 500); // input + avgOutput
    });

    it('should return Infinity for unknown model', function () {
      expect(estimateTokenCost('unknown-model', 100)).toBe(Infinity);
    });
  });

  describe('calculateCostCents', function () {
    it('should calculate cost in cents', function () {
      var cents = calculateCostCents('claude-opus-4-5-20250514', 10000, 5000, 0);
      expect(cents).toBeGreaterThan(0);
      expect(typeof cents).toBe('number');
    });

    it('should include thinking tokens in cost', function () {
      var withoutThinking = calculateCostCents('claude-opus-4-5-20250514', 10000, 5000, 0);
      var withThinking = calculateCostCents('claude-opus-4-5-20250514', 10000, 5000, 10000);
      expect(withThinking).toBeGreaterThan(withoutThinking);
    });
  });
});
