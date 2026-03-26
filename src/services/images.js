const { logger } = require('../config');

var cloudinary = null;

function getCloudinary() {
  if (cloudinary) return cloudinary;
  if (!process.env.CLOUDINARY_URL) return null;

  cloudinary = require('cloudinary').v2;
  // CLOUDINARY_URL env var is auto-parsed by the SDK
  return cloudinary;
}

function transformImageUrl(url, options) {
  var cl = getCloudinary();
  if (!cl) {
    // No Cloudinary — return original URL
    return url;
  }

  options = options || {};
  var width = options.width || 600;

  // Use Cloudinary fetch to transform remote images
  try {
    return cl.url(url, {
      type: 'fetch',
      effect: 'grayscale',
      width: width,
      crop: 'limit',
      format: 'jpg',
      quality: 'auto:low',
      secure: true,
    });
  } catch (err) {
    logger.warn({ err: err, url: url }, 'Cloudinary transform failed');
    return url;
  }
}

async function uploadBase64Image(base64Data, mimeType) {
  var cl = getCloudinary();
  if (!cl) return null;

  try {
    var dataUri = 'data:' + (mimeType || 'image/png') + ';base64,' + base64Data;
    var result = await cl.uploader.upload(dataUri, {
      folder: 'bridge-ai',
      transformation: [
        { effect: 'grayscale' },
        { width: 600, crop: 'limit' },
        { quality: 'auto:low' },
        { format: 'jpg' },
      ],
    });
    return result.secure_url;
  } catch (err) {
    logger.error({ err: err }, 'Cloudinary upload failed');
    return null;
  }
}

module.exports = { transformImageUrl, uploadBase64Image, getCloudinary };
