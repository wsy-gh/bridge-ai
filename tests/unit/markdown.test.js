const { renderMarkdown } = require('../../src/services/markdown');

describe('renderMarkdown', function () {
  it('should render basic markdown', function () {
    var html = renderMarkdown('**bold** and *italic*');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('should render code blocks', function () {
    var html = renderMarkdown('```\nconsole.log("hi")\n```');
    expect(html).toContain('<code>');
    expect(html).toContain('console.log');
  });

  it('should render inline code', function () {
    var html = renderMarkdown('use `var x = 1`');
    expect(html).toContain('<code>var x = 1</code>');
  });

  it('should strip script tags (XSS prevention)', function () {
    var html = renderMarkdown('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert');
  });

  it('should strip event handlers', function () {
    var html = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain('onerror');
  });

  it('should allow safe HTML tags', function () {
    var html = renderMarkdown('# Heading\n\n- item 1\n- item 2');
    expect(html).toContain('<h1>');
    expect(html).toContain('<li>');
  });

  it('should handle empty input', function () {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
  });

  it('should render links', function () {
    var html = renderMarkdown('[click here](https://example.com)');
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain('click here');
  });
});
