const { renderMarkdown } = require('../../src/services/markdown');

// Test the claude module's logic without hitting the real API
// The circuit breaker and API wrapper are tested via integration patterns
describe('claude service integration', function () {
  it('renderMarkdown is used by claude to produce contentHtml', function () {
    var html = renderMarkdown('# Hello\n\nThis is a **test**.');
    expect(html).toContain('<h1>');
    expect(html).toContain('<strong>test</strong>');
  });

  it('circuit breaker module loads without error', function () {
    // Just verify the module can be required
    var claude = require('../../src/services/claude');
    expect(typeof claude.sendMessage).toBe('function');
    expect(typeof claude.isCircuitOpen).toBe('function');
    expect(typeof claude.callClaude).toBe('function');
  });

  it('isCircuitOpen returns false initially', function () {
    var { isCircuitOpen } = require('../../src/services/claude');
    expect(isCircuitOpen()).toBe(false);
  });
});
