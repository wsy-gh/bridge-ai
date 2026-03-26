const { KINDLE_UA_PATTERNS } = require('../../src/middleware/kindle');

describe('Kindle UA detection', function () {
  var testUAs = [
    { ua: 'Mozilla/5.0 (Linux; U; en-US) AppleWebKit/528.5+ (KHTML, like Gecko, Safari/528.5+) Version/4.0 Kindle/3.0', expected: true },
    { ua: 'Mozilla/5.0 (Linux; Android 4.2.2; KFTT Build/JDQ39) AppleWebKit/537.36', expected: true },
    { ua: 'Mozilla/5.0 (Linux; U; Android 2.3.4; en-us; Silk/1.0.22.79_10013310) AppleWebKit/533.1', expected: true },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', expected: false },
    { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', expected: false },
    { ua: '', expected: false },
  ];

  testUAs.forEach(function (tc) {
    it('should ' + (tc.expected ? 'detect' : 'not detect') + ' Kindle: ' + (tc.ua.substring(0, 40) || '(empty)'), function () {
      var isKindle = KINDLE_UA_PATTERNS.some(function (pattern) {
        return pattern.test(tc.ua);
      });
      expect(isKindle).toBe(tc.expected);
    });
  });
});
