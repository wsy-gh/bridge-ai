var KINDLE_UA_PATTERNS = [
  /Kindle/i,
  /Silk/i,
  /KFTT/i,   // Kindle Fire
  /KFOT/i,   // Kindle Fire
  /KFJW/i,   // Kindle Fire HD
  /KFTH/i,   // Kindle Fire HDX
  /KFSOW/i,  // Kindle Fire
  /KFSAW/i,  // Kindle Fire HDX
];

function kindleDetect(req, res, next) {
  var ua = req.headers['user-agent'] || '';
  var isKindle = KINDLE_UA_PATTERNS.some(function (pattern) {
    return pattern.test(ua);
  });

  res.locals.isKindle = isKindle;

  if (isKindle) {
    // E-ink cache hints — avoid unnecessary re-renders
    res.set('Cache-Control', 'no-transform');
    // Prevent content negotiation issues on basic browsers
    res.set('Vary', 'User-Agent');
  }

  next();
}

module.exports = { kindleDetect, KINDLE_UA_PATTERNS };
