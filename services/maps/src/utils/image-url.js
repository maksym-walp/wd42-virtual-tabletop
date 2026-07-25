const MAX_URL_LENGTH = 500; // = VARCHAR(500) in the schema

// Accept either our own upload (/uploads/...) or an external https URL. This
// rejects javascript: and data: which would otherwise land in an <img src>.
// (Same guard as campaigns/campaign-gallery.controller.js.)
function isAllowedImageUrl(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_URL_LENGTH
    && (value.startsWith('/uploads/') || value.startsWith('https://'));
}

module.exports = { isAllowedImageUrl, MAX_URL_LENGTH };
