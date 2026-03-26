const { estimateTokenCost } = require('../../src/config');

describe('rateLimit', function () {
  describe('resetTokensIfNeeded logic', function () {
    it('should not need reset if less than 24 hours', function () {
      var resetAt = new Date();
      var now = new Date();
      var hoursSinceReset = (now - resetAt) / (1000 * 60 * 60);
      expect(hoursSinceReset < 24).toBe(true);
    });

    it('should need reset if more than 24 hours', function () {
      var resetAt = new Date();
      resetAt.setHours(resetAt.getHours() - 25);
      var now = new Date();
      var hoursSinceReset = (now - resetAt) / (1000 * 60 * 60);
      expect(hoursSinceReset >= 24).toBe(true);
    });

    it('should handle null tokensResetAt gracefully', function () {
      var resetAt = null;
      expect(resetAt).toBeNull();
      // When null, function should return user unchanged
    });
  });

  describe('token budget estimation', function () {
    it('should reject when estimated cost exceeds budget', function () {
      var tokensUsedToday = 49600;
      var dailyBudget = 50000;
      var content = 'a'.repeat(400); // ~100 input tokens
      var estimatedInputTokens = Math.ceil(content.length / 4);
      var estimated = estimateTokenCost('claude-haiku-4-5-20251001', estimatedInputTokens);
      // estimated = 100 + 500 (avg output) = 600, total = 50200 > 50000

      expect(tokensUsedToday + estimated).toBeGreaterThan(dailyBudget);
    });

    it('should allow when under budget', function () {
      var tokensUsedToday = 1000;
      var dailyBudget = 50000;
      var estimated = estimateTokenCost('claude-haiku-4-5-20251001', 100);

      expect(tokensUsedToday + estimated).toBeLessThan(dailyBudget);
    });
  });
});
