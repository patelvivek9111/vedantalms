const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Lightweight function to check if user is authenticated
 * This doesn't throw errors, just returns true/false
 * Used for rate limiting decisions before protect middleware runs
 * 
 * Note: For performance, we only verify the JWT token is valid.
 * We don't check if the user exists in the database - that's done
 * by the protect middleware later. This makes rate limiting fast.
 */
const isAuthenticated = (req) => {
  // If user is already set by protect middleware, use that
  if (req.user) {
    return true;
  }

  // Check for token in header
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return false;
  }

  try {
    // Verify token without throwing (silent check)
    // We only verify JWT signature and expiration, not database lookup
    // This is fast enough for rate limiting purposes
    if (!process.env.JWT_SECRET) {
      return false;
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // If token is valid (not expired, correct signature), consider authenticated
    // The protect middleware will do full validation later
    return !!decoded && !!decoded.id;
  } catch (err) {
    // Token invalid or expired
    return false;
  }
};

/**
 * General API rate limiter (for unauthenticated users)
 * Limits: 300 requests per 15 minutes per IP
 * Increased from 250 to accommodate normal usage
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs (increased from 250)
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    // Calculate retry after time (in seconds)
    const resetTime = req.rateLimit?.resetTime || Date.now() + (15 * 60 * 1000);
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    
    logger.warn('Rate limit exceeded (unauthenticated)', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      retryAfter
    });
    
    // Set Retry-After header (in seconds)
    res.setHeader('Retry-After', retryAfter);
    
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      retryAfter,
      retryAfterSeconds: retryAfter
    });
  }
});

/**
 * Authenticated API rate limiter (for authenticated users)
 * Higher limits since authenticated users are trusted
 * Limits: 500 requests per 15 minutes per IP
 * Increased from 300 to accommodate polling and normal authenticated usage
 */
const authenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs (increased from 300)
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    // Calculate retry after time (in seconds)
    const resetTime = req.rateLimit?.resetTime || Date.now() + (15 * 60 * 1000);
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    
    logger.warn('Authenticated rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?._id || 'unknown',
      retryAfter
    });
    
    // Set Retry-After header (in seconds)
    res.setHeader('Retry-After', retryAfter);
    
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      retryAfter,
      retryAfterSeconds: retryAfter
    });
  }
});

/**
 * Smart rate limiter that automatically chooses the right limiter
 * based on authentication status
 * 
 * This is a synchronous function for performance - we only verify
 * JWT token validity, not database lookup
 */
const smartLimiter = (req, res, next) => {
  // Check if user is authenticated (lightweight JWT check only)
  const authenticated = isAuthenticated(req);
  
  // Use appropriate limiter based on authentication status
  if (authenticated) {
    return authenticatedLimiter(req, res, next);
  } else {
    return apiLimiter(req, res, next);
  }
};

/**
 * Strict rate limiter for authentication endpoints
 * Limits: 5 requests per 15 minutes per IP
 * Prevents brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded - possible brute force attack', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      email: req.body?.email || 'unknown'
    });
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again after 15 minutes.'
    });
  }
});

/**
 * Registration rate limiter
 * Limits: 3 registrations per hour per IP
 * Prevents spam registrations
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registrations per hour
  message: {
    success: false,
    message: 'Too many registration attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Registration rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      email: req.body?.email || 'unknown'
    });
    res.status(429).json({
      success: false,
      message: 'Too many registration attempts, please try again later.'
    });
  }
});

module.exports = {
  apiLimiter,
  authenticatedLimiter,
  authLimiter,
  registerLimiter,
  smartLimiter
};

