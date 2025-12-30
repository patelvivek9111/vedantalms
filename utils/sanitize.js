/**
 * Sanitization utility
 * Provides functions to sanitize user input and prevent XSS attacks
 */

/**
 * Sanitize HTML string by removing potentially dangerous tags and attributes
 * @param {string} html - HTML string to sanitize
 * @returns {string} - Sanitized HTML string
 */
const sanitizeHTML = (html) => {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Remove script tags and their content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onerror, etc.)
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: protocol
  html = html.replace(/javascript:/gi, '');
  
  // Remove data: URLs that could be used for XSS
  html = html.replace(/data:text\/html/gi, '');
  
  return html;
};

/**
 * Sanitize plain text by escaping HTML entities
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };

  return text.replace(/[&<>"'/]/g, (char) => map[char]);
};

/**
 * Sanitize object recursively
 * @param {any} obj - Object to sanitize
 * @param {boolean} sanitizeHTML - Whether to sanitize HTML strings
 * @returns {any} - Sanitized object
 */
const sanitizeObject = (obj, sanitizeHTMLStrings = false) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeHTMLStrings ? sanitizeHTML(obj) : sanitizeText(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, sanitizeHTMLStrings));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key], sanitizeHTMLStrings);
      }
    }
    return sanitized;
  }

  return obj;
};

module.exports = {
  sanitizeHTML,
  sanitizeText,
  sanitizeObject
};
