const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const pino = require('pino');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Create HTTP server for Socket.io
const server = http.createServer(app);

// CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? [
        process.env.FRONTEND_URL || 'https://vedantaed.com',
        'https://www.vedantaed.com',
          'https://vedantaed.com',
          'https://vedantalms-backend.onrender.com',
      ]
      : ['http://localhost:3000', 'http://localhost:5173'];
    
    // Check if origin is in allowed list or matches patterns
    const isAllowed = allowedOrigins.includes(origin) ||
      origin.endsWith('.onrender.com') ||
      origin.endsWith('.vercel.app');
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(helmet({
  crossOriginResourcePolicy: false
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined
});
let redisAdapterEnabled = false;
let redisAdapterError = null;
let socketEngineConnectionErrors = 0;
const requestMetrics = {
  startedAt: Date.now(),
  total: 0,
  status2xx: 0,
  status4xx: 0,
  status5xx: 0,
  latencyMs: []
};

const summarizeLatency = (samples) => {
  if (!samples.length) {
    return { p50: 0, p95: 0, p99: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  return {
    p50: Number(percentile(50).toFixed(2)),
    p95: Number(percentile(95).toFixed(2)),
    p99: Number(percentile(99).toFixed(2))
  };
};

const { getSocketMetrics, initializeQuizWaveSocket } = require('./socket/quizwave.socket');

const buildHealthOpsPayload = () => {
  const uptimeSeconds = Math.floor((Date.now() - requestMetrics.startedAt) / 1000);
  const latency = summarizeLatency(requestMetrics.latencyMs);
  const errorRate = requestMetrics.total > 0
    ? Number((((requestMetrics.status4xx + requestMetrics.status5xx) / requestMetrics.total) * 100).toFixed(2))
    : 0;
  return {
    status: 'ok',
    uptimeSeconds,
    requestMetrics: {
      total: requestMetrics.total,
      status2xx: requestMetrics.status2xx,
      status4xx: requestMetrics.status4xx,
      status5xx: requestMetrics.status5xx,
      errorRatePercent: errorRate,
      latencyMs: latency
    },
    dependencies: {
      mongoConnected: mongoose.connection.readyState === 1,
      redisAdapterEnabled,
      redisAdapterError
    },
    socketEngine: {
      connectionErrors: socketEngineConnectionErrors
    },
    socketMetrics: getSocketMetrics()
  };
};

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const renderPrometheusMetrics = (payload) => {
  const m = payload.requestMetrics;
  const lat = m.latencyMs || {};
  const d = payload.dependencies;
  const s = payload.socketMetrics || {};
  const eng = payload.socketEngine || {};
  const lines = [];
  const emit = (name, type, help, value) => {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} ${type}`);
    lines.push(`${name} ${num(value)}`);
  };
  emit('lms_process_uptime_seconds', 'gauge', 'Application uptime in seconds.', payload.uptimeSeconds);
  emit('lms_http_requests_recorded_total', 'gauge', 'HTTP requests counted in rolling window.', m.total);
  emit('lms_http_responses_2xx_total', 'gauge', '2xx responses in rolling window.', m.status2xx);
  emit('lms_http_responses_4xx_total', 'gauge', '4xx responses in rolling window.', m.status4xx);
  emit('lms_http_responses_5xx_total', 'gauge', '5xx responses in rolling window.', m.status5xx);
  emit('lms_http_error_rate_percent', 'gauge', '4xx+5xx divided by total times 100.', m.errorRatePercent);
  emit('lms_http_request_latency_p50_ms', 'gauge', 'Rolling p50 HTTP latency ms.', lat.p50);
  emit('lms_http_request_latency_p95_ms', 'gauge', 'Rolling p95 HTTP latency ms.', lat.p95);
  emit('lms_http_request_latency_p99_ms', 'gauge', 'Rolling p99 HTTP latency ms.', lat.p99);
  emit('lms_dependency_mongo_up', 'gauge', '1 if mongoose connected.', d.mongoConnected ? 1 : 0);
  emit('lms_dependency_redis_adapter_up', 'gauge', '1 if Socket.IO Redis adapter enabled.', d.redisAdapterEnabled ? 1 : 0);
  emit('lms_socket_engine_connection_errors_total', 'gauge', 'Socket.IO engine connection_error count.', eng.connectionErrors);
  emit('lms_socket_connected_total', 'gauge', 'QuizWave socket connected count.', s.connected);
  emit('lms_socket_disconnected_total', 'gauge', 'QuizWave socket disconnected count.', s.disconnected);
  emit('lms_socket_auth_errors_total', 'gauge', 'QuizWave socket auth errors.', s.authErrors);
  emit('lms_socket_event_errors_total', 'gauge', 'QuizWave socket handler errors.', s.eventErrors);
  emit('lms_socket_throttled_total', 'gauge', 'QuizWave inbound events rate-limited.', s.throttled ?? 0);
  emit('lms_socket_currently_connected', 'gauge', 'Estimated current QuizWave connections.', s.currentlyConnected ?? 0);
  emit('lms_quizwave_active_sessions', 'gauge', 'QuizWave active session map size.', s.activeSessionCount ?? 0);
  return lines.join('\n');
};

app.use(pinoHttp({
  logger,
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url
      };
    }
  }
}));

app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    requestMetrics.total += 1;
    if (res.statusCode >= 500) {
      requestMetrics.status5xx += 1;
    } else if (res.statusCode >= 400) {
      requestMetrics.status4xx += 1;
    } else if (res.statusCode >= 200) {
      requestMetrics.status2xx += 1;
    }
    requestMetrics.latencyMs.push(durationMs);
    if (requestMetrics.latencyMs.length > 1000) {
      requestMetrics.latencyMs.shift();
    }
    req.log.info({
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2))
    }, 'request.completed');
  });
  next();
});

// Course pages fan out many parallel GETs; a low RATE_LIMIT_MAX in .env or a tight default
// causes 429 after a single navigation. Dev/test skip limits unless ENFORCE_RATE_LIMIT_IN_DEV.
const applyApiRateLimits =
  process.env.NODE_ENV === 'production'
    ? process.env.DISABLE_RATE_LIMIT !== 'true'
    : process.env.ENFORCE_RATE_LIMIT_IN_DEV === 'true';

const skipApiRateLimit = () => !applyApiRateLimits;

const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || `${60 * 1000}`, 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '900', 10),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipApiRateLimit
});

const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10),
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication requests, try again later.' },
  skip: skipApiRateLimit
});

const contactInquiryLimiter = rateLimit({
  windowMs: parseInt(process.env.CONTACT_INQUIRY_WINDOW_MS || `${15 * 60 * 1000}`, 10),
  max: parseInt(process.env.CONTACT_INQUIRY_MAX || '8', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many contact requests. Please try again later.' },
  skip: skipApiRateLimit
});

const writeLimiter = rateLimit({
  windowMs: parseInt(process.env.WRITE_RATE_LIMIT_WINDOW_MS || `${60 * 1000}`, 10),
  max: parseInt(process.env.WRITE_RATE_LIMIT_MAX || '240', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many write requests, please slow down.' },
  skip: skipApiRateLimit
});

/** GET/HEAD/OPTIONS stay on the general `/api` limiter only; mutations keep the stricter write cap. */
const writeLimiterUnlessRead = (req, res, next) => {
  const m = req.method;
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') {
    return next();
  }
  return writeLimiter(req, res, next);
};

app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter);
app.use(['/api/submissions', '/api/inbox', '/api/grades', '/api/upload'], writeLimiterUnlessRead);


// Set default JWT secret if not in environment
if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
  process.env.JWT_SECRET = 'your-super-secret-jwt-key-123';
}
process.env.JWT_EXPIRE = process.env.JWT_EXPIRE || '30d';
const { isCloudinaryConfigured } = require('./utils/cloudinary');

const validateProductionSetup = () => {
  if (process.env.NODE_ENV !== 'production') return;

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-secret-jwt-key-123') {
    console.error('❌ Production startup blocked: JWT_SECRET must be a strong secret');
    process.exit(1);
  }

  if (process.env.REQUIRE_REDIS === 'true' && !process.env.REDIS_URL) {
    console.error('❌ Production startup blocked: REQUIRE_REDIS=true but REDIS_URL is not set');
    process.exit(1);
  }

  if (process.env.FORCE_OBJECT_STORAGE === 'true' && !isCloudinaryConfigured()) {
    console.error('❌ Production startup blocked: FORCE_OBJECT_STORAGE=true but Cloudinary credentials are missing');
    process.exit(1);
  }
};
validateProductionSetup();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// MongoDB connection options
const mongoOptions = {
  dbName: 'lms',
  maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '80', 10),
  minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '10', 10),
  serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || '5000', 10),
  socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS || '45000', 10),
};

// Connect to MongoDB
let MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

// Validate MongoDB URI
if (!MONGODB_URI || !MONGODB_URI.trim()) {
  console.error('❌ MongoDB connection error: MONGODB_URI environment variable is not set or is empty');
  console.error('Please set MONGODB_URI in your environment variables.');
  console.error('For MongoDB Atlas, use: mongodb+srv://username:password@cluster.mongodb.net/dbname');
  console.error('For local MongoDB, use: mongodb://localhost:27017/lms');
  process.exit(1);
}

// Clean and extract MongoDB URI (in case there are prefixes or extra characters)
MONGODB_URI = MONGODB_URI.trim();

// Try to extract a valid MongoDB URI if it's embedded in the string
if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
  // Look for mongodb:// or mongodb+srv:// in the string
  const mongodbMatch = MONGODB_URI.match(/(mongodb(?:\+srv)?:\/\/[^\s]+)/);
  if (mongodbMatch) {
    // Warning: Found MongoDB URI embedded in string, extracting it...
    MONGODB_URI = mongodbMatch[1];
  } else {
    console.error('❌ MongoDB connection error: Invalid connection string format');
    console.error('MONGODB_URI must start with "mongodb://" or "mongodb+srv://"');
    console.error(`Current value (first 50 chars): ${MONGODB_URI.substring(0, 50)}`);
    console.error('Full value length:', MONGODB_URI.length);
    console.error('\nPlease check your MONGODB_URI in Render dashboard:');
    console.error('1. Go to your Render service dashboard');
    console.error('2. Navigate to Environment tab');
    console.error('3. Check the MONGODB_URI value');
    console.error('4. Make sure it starts with "mongodb://" or "mongodb+srv://"');
    console.error('5. Remove any extra characters, spaces, or prefixes');
    console.error('\nExample format: mongodb+srv://username:password@cluster.mongodb.net/dbname');
    process.exit(1);
  }
}

mongoose.connect(MONGODB_URI, mongoOptions)
  .then(async () => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    // Connected to MongoDB (non-test)
    const { initializeEmailService } = require('./utils/emailService');
    const { ensureCriticalIndexes } = require('./utils/ensureIndexes');
    await ensureCriticalIndexes(logger);
    await initializeEmailService();
  })
  .catch((err) => {
    console.error('❌ MongoDB startup error:', err.message);
    if (String(err.message || '').toLowerCase().includes('index')) {
      console.error('Index sync failed. Check model index definitions and your MongoDB provider index feature support.');
    } else {
      const envHint = process.env.RENDER
        ? 'On Render: Environment → set MONGODB_URI, and in Atlas Network Access allow 0.0.0.0/0 (or Render outbound IPs).'
        : 'Locally: set MONGODB_URI in .env (or your shell). In Atlas → Network Access, add your current public IP or 0.0.0.0/0 for development only.';
      console.error(envHint);
    }
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    process.exit(1); // Exit if cannot connect to database
  });

// Serve uploads directory for profile pictures and other files
// IMPORTANT: This must be BEFORE frontend static files and catch-all route
const uploadsStatic = express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    // Set proper headers for images
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.png') || filePath.endsWith('.gif')) {
      res.setHeader('Content-Type', filePath.endsWith('.png') ? 'image/png' : 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
});

app.use('/uploads', (req, res, next) => {
  // Check if file exists before serving
  const filePath = path.join(__dirname, 'uploads', req.path.replace('/uploads/', ''));
  if (fs.existsSync(filePath)) {
    uploadsStatic(req, res, next);
  } else {
    // File doesn't exist - return 404 (browser will handle fallback)
    res.status(404).json({ message: 'File not found' });
  }
});

// Routes
app.use('/api/contact', contactInquiryLimiter, require('./routes/contact.routes'));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/catalog', require('./routes/catalog.routes'));
app.use('/api/courses', require('./routes/course.routes'));
app.use('/api/modules', require('./routes/module.routes'));
app.use('/api/pages', require('./routes/page.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/assignments', require('./routes/assignment.routes'));
app.use('/api/submissions', require('./routes/submission.routes'));
app.use('/api/threads', require('./routes/thread.routes'));
app.use('/api/grades', require('./routes/grades.routes'));
app.use('/api/groups', require('./routes/groupRoutes'));
app.use('/api/announcements', require('./routes/announcement.routes'));
app.use('/api/events', require('./routes/event.routes'));
app.use('/api/todos', require('./routes/todo.routes'));
app.use('/api/inbox', require('./routes/inbox.routes'));
app.use('/api', require('./routes/attendance.routes'));
app.use('/api/polls', require('./routes/poll.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/notifications', require('./routes/notification.routes').router);
app.use('/api/quizwave', require('./routes/quizwave.routes'));
app.use('/api/integrations/zoho-meeting', require('./routes/zohoMeeting.routes'));

// Upload route for file uploads
const upload = require('./middleware/upload');
const { protect } = require('./middleware/auth');
const { uploadMultipleToCloudinary } = require('./utils/cloudinary');

app.post('/api/upload', protect, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }
    
    let files;
    
    // Use Cloudinary if configured, otherwise use local storage
    if (isCloudinaryConfigured()) {
      try {
        const cloudinaryResults = await uploadMultipleToCloudinary(req.files, {
          folder: 'lms/uploads'
        });
        
        files = cloudinaryResults.map((result, index) => ({
          originalname: req.files[index].originalname,
          filename: result.public_id.split('/').pop(),
          path: result.url, // Cloudinary URL
          size: result.bytes,
          cloudinary: true
        }));
      } catch (cloudinaryError) {
        if (process.env.NODE_ENV === 'production') {
          return res.status(503).json({ message: 'Object storage upload failed. Please retry later.' });
        }
        if (req.files.some(file => !file.path || !file.filename)) {
          return res.status(503).json({ message: 'File storage unavailable. Please retry later.' });
        }
        // Cloudinary upload failed, falling back to local storage when available
        files = req.files.map(file => ({
          originalname: file.originalname,
          filename: file.filename,
          path: `/uploads/${file.filename}`,
          size: file.size,
          cloudinary: false
        }));
      }
    } else {
      if (process.env.NODE_ENV === 'production' && process.env.FORCE_OBJECT_STORAGE === 'true') {
        return res.status(503).json({ message: 'Object storage is required in production but not configured.' });
      }
      // Local storage
      files = req.files.map(file => ({
      originalname: file.originalname,
      filename: file.filename,
      path: `/uploads/${file.filename}`,
        size: file.size,
        cloudinary: false
    }));
    }
    
    res.json({ 
      message: 'Files uploaded successfully',
      files: files
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading files' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong!' 
    : err.message;
    
  res.status(err.status || 500).json({ 
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// API route not found handler (must be after all API routes but before static files)
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    message: 'API route not found', 
    path: req.path,
    method: req.method 
  });
});

// Health check endpoint (before static files)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

app.get('/health/ready', async (req, res) => {
  const mongoConnected = mongoose.connection.readyState === 1;
  const objectStorageReady = isCloudinaryConfigured();
  const objectStorageMode = objectStorageReady ? 'cloudinary' : 'local';
  const redisRequired = process.env.REQUIRE_REDIS === 'true';
  const objectStorageRequired = process.env.FORCE_OBJECT_STORAGE === 'true';
  const redisReady = redisAdapterEnabled || !redisRequired;
  const storageReady = objectStorageReady || !objectStorageRequired;
  const healthy = mongoConnected && redisReady && storageReady;

  const payload = {
    status: healthy ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      mongoConnected,
      redisAdapterEnabled,
      redisRequired,
      objectStorageReady,
      objectStorageMode,
      objectStorageRequired
    },
    redisAdapterError
  };

  res.status(healthy ? 200 : 503).json(payload);
});

app.get('/health/ops', (req, res) => {
  res.json(buildHealthOpsPayload());
});

// Prometheus text exposition (same signals as /health/ops) for Grafana / Alertmanager
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(renderPrometheusMetrics(buildHealthOpsPayload()));
});

// Test POST endpoint to verify POST requests work
app.post('/api/test-post', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'POST request received',
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the frontend/dist directory (only for GET requests to non-API paths)
  app.use((req, res, next) => {
    // Skip static file serving for API routes, uploads, and non-GET requests
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.method !== 'GET') {
      return next();
    }
    // Use static middleware only for GET requests to non-API paths
    express.static(path.join(__dirname, 'frontend', 'dist'))(req, res, next);
  });
  
  // Handle all non-API routes by serving the frontend (must be last)
  app.get('*', (req, res, next) => {
    // Don't serve frontend for API routes or uploads
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
  });
}

const socketPingTimeoutMs = parseInt(process.env.SOCKET_PING_TIMEOUT_MS || '20000', 10);
const socketPingIntervalMs = parseInt(process.env.SOCKET_PING_INTERVAL_MS || '25000', 10);
const socketConnectTimeoutMs = parseInt(process.env.SOCKET_CONNECT_TIMEOUT_MS || '45000', 10);
const socketMaxHttpBufferBytes = parseInt(process.env.SOCKET_MAX_HTTP_BUFFER_BYTES || '1048576', 10);

const configureSocketRedisAdapter = async (socketIo) => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn('REDIS_URL not set; socket.io running without redis adapter');
    return;
  }
  try {
    const pubClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      commandTimeout: 1000,
      enableOfflineQueue: false,
      retryStrategy: () => null
    });
    const subClient = pubClient.duplicate();
    pubClient.on('error', (error) => {
      redisAdapterError = error?.message || 'redis pub client error';
    });
    subClient.on('error', (error) => {
      redisAdapterError = error?.message || 'redis sub client error';
    });
    await Promise.all([pubClient.connect(), subClient.connect()]);
    socketIo.adapter(createAdapter(pubClient, subClient));
    redisAdapterEnabled = true;
    redisAdapterError = null;
    logger.info('socket.io redis adapter enabled');
  } catch (error) {
    redisAdapterEnabled = false;
    redisAdapterError = error?.message || 'unknown redis adapter error';
    logger.error({ err: error }, 'failed to enable socket.io redis adapter');
  }
};

// Socket.IO + Redis are omitted under NODE_ENV=test so Jest workers can exit cleanly (HTTP routes still tested via supertest).
let io = null;
if (process.env.NODE_ENV !== 'test') {
  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL || 'https://vedantaed.com', 'https://www.vedantaed.com']
        : ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST']
    },
    connectTimeout: socketConnectTimeoutMs,
    pingTimeout: socketPingTimeoutMs,
    pingInterval: socketPingIntervalMs,
    maxHttpBufferSize: socketMaxHttpBufferBytes,
    transports: ['websocket', 'polling']
  });

  io.engine.on('connection_error', (err) => {
    socketEngineConnectionErrors += 1;
    logger.warn({ err: err?.message || String(err) }, 'socket.io engine connection_error');
  });

  configureSocketRedisAdapter(io);
  initializeQuizWaveSocket(io);
}

// Start QuizWave auto-cleanup scheduler (skip in tests — avoids open timers + async logs after Jest teardown)
const { startCleanupScheduler } = require('./utils/quizwaveCleanup');
if (process.env.NODE_ENV !== 'test') {
  startCleanupScheduler();
}

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  // Start server
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    // Server running
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    // SIGTERM received, shutting down gracefully
    io.close(() => {
      mongoose.connection.close(() => {
        // MongoDB connection closed
        process.exit(0);
      });
    });
  });

  process.on('SIGINT', () => {
    // SIGINT received, shutting down gracefully
    io.close(() => {
      mongoose.connection.close(() => {
        // MongoDB connection closed
        process.exit(0);
      });
    });
  });
}

// Export app for testing
module.exports = app; 