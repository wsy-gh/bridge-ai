const { transformImageUrl } = require('../../src/services/images');

describe('images service', function () {
  it('should return original URL when Cloudinary is not configured', function () {
    // CLOUDINARY_URL is not set in test env
    var url = 'https://example.com/image.png';
    var result = transformImageUrl(url);
    expect(result).toBe(url);
  });

  it('should handle options gracefully without Cloudinary', function () {
    var url = 'https://example.com/photo.jpg';
    var result = transformImageUrl(url, { width: 400 });
    expect(result).toBe(url);
  });
});
