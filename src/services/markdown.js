const { marked } = require('marked');
const createDOMPurify = require('isomorphic-dompurify');

const DOMPurify = createDOMPurify;

// Configure marked for safe, readable HTML
marked.setOptions({
  gfm: true,
  breaks: true,
});

function renderMarkdown(text) {
  if (!text) return '';

  var html = marked.parse(text);

  // Sanitize with DOMPurify
  var clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'b', 'i', 'u',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'pre', 'code',
      'blockquote',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'hr', 'del', 'sup', 'sub',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
    ALLOW_DATA_ATTR: false,
  });

  return clean;
}

module.exports = { renderMarkdown };
