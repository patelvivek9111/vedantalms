const logger = require('./logger');

// Base Error Class
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Custom Error Classes
class ValidationError extends AppError {
  constructor(message = 'Validation error', errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden access') {
    super(message, 403);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
  }
}

// Async Handler - Wraps async route handlers to catch errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Send Error Response
const sendErrorResponse = (res, error, context = {}) => {
  const statusCode = error.statusCode || 500;
  const status = error.status || 'error';
  
  // Log error
  if (statusCode >= 500) {
    logger.error('Server error', {
      error: error.message,
      stack: error.stack,
      context
    });
  } else {
    logger.warn('Client error', {
      error: error.message,
      statusCode,
      context
    });
  }

  // Build response
  const response = {
    success: false,
    error: {
      message: error.message || 'An error occurred',
      status,
      statusCode
    }
  };

  // Add validation errors if present
  if (error.errors && Array.isArray(error.errors)) {
    response.error.errors = error.errors;
  }

  // Add context in development
  if (process.env.NODE_ENV === 'development' && context) {
    response.error.context = context;
  }

  res.status(statusCode).json(response);
};

// Handle Mongoose Errors
const handleMongooseError = (error) => {
  let message = 'Database error';
  let statusCode = 500;

  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message
    }));
    return new ValidationError('Validation error', errors);
  }

  if (error.name === 'CastError') {
    message = 'Invalid ID format';
    statusCode = 400;
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    message = `${field} already exists`;
    statusCode = 409;
    return new ConflictError(message);
  }

  return new AppError(message, statusCode);
};

// Global Error Handler Middleware
const globalErrorHandler = (err, req, res, next) => {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle known error types
  if (err instanceof AppError) {
    return sendErrorResponse(res, err, {
      action: 'global_error_handler',
      path: req.path,
      method: req.method
    });
  }

  // Handle Mongoose errors
  if (err.name === 'ValidationError' || err.name === 'CastError' || err.code === 11000) {
    const mongooseError = handleMongooseError(err);
    return sendErrorResponse(res, mongooseError, {
      action: 'global_error_handler',
      path: req.path,
      method: req.method
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendErrorResponse(res, new UnauthorizedError('Invalid token'), {
      action: 'global_error_handler',
      path: req.path,
      method: req.method
    });
  }

  if (err.name === 'TokenExpiredError') {
    return sendErrorResponse(res, new UnauthorizedError('Token expired'), {
      action: 'global_error_handler',
      path: req.path,
      method: req.method
    });
  }

  // Unknown errors - return generic 500
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  return sendErrorResponse(res, new AppError('Internal server error', 500), {
    action: 'global_error_handler',
    path: req.path,
    method: req.method
  });
};

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  asyncHandler,
  sendErrorResponse,
  handleMongooseError,
  globalErrorHandler
};

