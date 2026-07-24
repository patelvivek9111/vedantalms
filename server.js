// Initialize Sentry first (no-op when SENTRY_DSN is unset).
require('./instrument');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const pino = require('pino');
const { requestCorrelation } = require('./middleware/requestCorrelation');
const { mongoSanitize } = require('./middleware/mongoSanitize');
const { metricsAuth } = require('./middleware/metricsAuth');
const { validateStartupEnv } = require('./config/startupValidation');
const { resolveMongoDbName } = require('./scripts/resolveMongoDbName');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');

// Load environment variables
dotenv.config();
validateStartupEnv();

// Create Express app
const app = express();

// Trust reverse proxy (Render, nginx) for accurate req.ip and secure cookies
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Create HTTP server for Socket.io
const server = http.createServer(app);

const { createCorsOriginCallback, getProductionOrigins, getDevOrigins } = require('./config/cors');

const corsOptions = {
  origin: createCorsOriginCallback(),
  credentials: true,
  optionsSuccessStatus: 200,
  // Required so the browser can read Location on 302 stream/download redirects to Cloudinary.
  exposedHeaders: ['Location'],
};

// Middleware
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(requestCorrelation);
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Strip $-operator / dotted keys before any controller sees the request.
app.use(mongoSanitize);

// ACME HTTP-01 challenge (Let's Encrypt) — must be public and unauthenticated
app.get('/.well-known/acme-challenge/:token', (req, res) => {
  try {
    const { getHttp01Authorization } = require('./services/tenancy/domainTls.service');
    const auth = getHttp01Authorization(req.params.token);
    if (!auth) return res.status(404).send('Not found');
    return res.type('text/plain').send(auth);
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined
});
const lifecycle = {
  startupPhase: 'logger.initialized',
  mongoStartupComplete: false,
  mongoStartupError: null,
  apiSchedulersEnabled:
    process.env.ENABLE_API_SCHEDULERS === 'true' ||
    process.env.START_API_SCHEDULERS === 'true',
};

const logStartupPhase = (phase, fields = {}) => {
  lifecycle.startupPhase = phase;
  logger.info({ phase, ...fields }, 'startup.phase');
};

const logFatalProcessError = (kind, error) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.fatal({ err, kind, startupPhase: lifecycle.startupPhase }, 'process.fatal');
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  process.on('unhandledRejection', (reason) => logFatalProcessError('unhandledRejection', reason));
  process.on('uncaughtException', (err) => logFatalProcessError('uncaughtException', err));
}
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
const {
  initializeMessagingSocket,
  getMessagingSocketMetrics,
} = require('./socket/messaging.socket');
const {
  initializeNotificationSocket,
  getNotificationSocketMetrics,
} = require('./socket/notification.socket');
const costGovernanceMetrics = require('./services/costGovernanceMetrics.service');

const buildHealthOpsPayload = () => {
  const uptimeSeconds = Math.floor((Date.now() - requestMetrics.startedAt) / 1000);
  const latency = summarizeLatency(requestMetrics.latencyMs);
  const errorRate = requestMetrics.total > 0
    ? Number((((requestMetrics.status4xx + requestMetrics.status5xx) / requestMetrics.total) * 100).toFixed(2))
    : 0;
  const notificationSocketMetrics = getNotificationSocketMetrics();
  const messagingSocketMetrics = getMessagingSocketMetrics();
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
      mongoStartupComplete: lifecycle.mongoStartupComplete,
      redisAdapterEnabled,
      redisAdapterError
    },
    lifecycle: {
      startupPhase: lifecycle.startupPhase,
      apiSchedulersEnabled: lifecycle.apiSchedulersEnabled,
      mongoStartupError: lifecycle.mongoStartupError,
    },
    socketEngine: {
      connectionErrors: socketEngineConnectionErrors
    },
    socketMetrics: getSocketMetrics(),
    messagingSocketMetrics,
    notificationSocketMetrics,
    costGovernance: costGovernanceMetrics.buildRealtimeEfficiencySnapshot({
      notificationSocketMetrics,
      messagingSocketMetrics,
    }),
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
  const msg = payload.messagingSocketMetrics || {};
  const notif = payload.notificationSocketMetrics || {};
  const cg = payload.costGovernance || {};
  const poll = cg.poll?.estimatedPerHour || {};
  emit('lms_messaging_socket_connected', 'gauge', 'Inbox websocket connections.', msg.currentlyConnected ?? 0);
  emit('lms_notification_socket_connected', 'gauge', 'Notification websocket connections.', notif.currentlyConnected ?? 0);
  emit('lms_poll_requests_per_hour_total', 'gauge', 'Estimated badge/list poll requests per hour.', poll.totalPoll ?? 0);
  emit('lms_poll_per_ws_connection_per_hour', 'gauge', 'Poll per hour divided by total WS connections.', cg.ratios?.pollPerHourPerWsConnection ?? 0);
  emit('lms_cost_governance_realtime_degraded', 'gauge', '1 if poll/WS efficiency status is degraded.', cg.status === 'degraded' ? 1 : 0);
  return lines.join('\n');
};

app.use(pinoHttp({
  logger,
  genReqId: (req) => req.requestId,
  serializers: {
    req(req) {
      return {
        id: req.requestId || req.id,
        auditCorrelationId: req.auditCorrelationId,
        method: req.method,
        url: req.url,
        rootAccountId: req.rootAccountId ? String(req.rootAccountId) : undefined,
        tenantHost: req.tenantHost || undefined,
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
      durationMs: Number(durationMs.toFixed(2)),
      rootAccountId: req.rootAccountId ? String(req.rootAccountId) : undefined,
      tenantHost: req.tenantHost || undefined,
      impersonating: Boolean(req.isImpersonating),
    }, 'request.completed');
    costGovernanceMetrics.recordPollRequest(req.method, req.originalUrl || req.url);
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

  if (process.env.PREVIEW_STORAGE === 'cloudinary' && !isCloudinaryConfigured()) {
    console.error('❌ Production startup blocked: PREVIEW_STORAGE=cloudinary but Cloudinary credentials are missing');
    process.exit(1);
  }
};
validateProductionSetup();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// MongoDB connection options (dbName resolved after URI is validated below)
const mongoOptions = {
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

mongoOptions.dbName = resolveMongoDbName(MONGODB_URI);

logStartupPhase('mongo.connecting', {
  dbName: mongoOptions.dbName,
  serverSelectionTimeoutMS: mongoOptions.serverSelectionTimeoutMS,
});

function mongoStartupEnvHint(err) {
  if (String(err?.message || '').toLowerCase().includes('index')) {
    console.error('Index sync failed. Check model index definitions and your MongoDB provider index feature support.');
    return;
  }
  const envHint = process.env.RENDER
    ? 'On Render: Environment → set MONGODB_URI, and in Atlas Network Access allow 0.0.0.0/0 (or Render outbound IPs).'
    : 'Locally: set MONGODB_URI in .env (or your shell). In Atlas → Network Access, add your current public IP or 0.0.0.0/0 for development only.';
  console.error(envHint);
}

async function runMongoStartupTasks() {
  logStartupPhase('mongo.connected');
  const { initializeEmailService } = require('./utils/emailService');
  const { ensureCriticalIndexes } = require('./utils/ensureIndexes');
  const { ensureDefaultRootAccount } = require('./services/tenancy/ensureDefaultRootAccount.service');
  logStartupPhase('indexes.syncing');
  await ensureCriticalIndexes(logger);
  logStartupPhase('tenancy.bootstrap');
  const rootAccount = await ensureDefaultRootAccount();
  // Lightweight claim of orphan rows so existing deploys keep working
  try {
    const User = require('./models/user.model');
    const Course = require('./models/course.model');
    const orphanFilter = {
      $or: [{ rootAccountId: null }, { rootAccountId: { $exists: false } }],
    };
    await User.updateMany(orphanFilter, {
      $set: { rootAccountId: rootAccount._id, accountId: rootAccount._id },
    });
    await Course.updateMany(orphanFilter, {
      $set: { rootAccountId: rootAccount._id, accountId: rootAccount._id },
    });
  } catch (err) {
    logger.warn({ err }, 'tenancy.backfill.partial_failure');
  }
  logStartupPhase('email.initializing');
  await initializeEmailService();
  const { refreshSecurityPolicyCache } = require('./services/securityPolicy.service');
  await refreshSecurityPolicyCache(rootAccount._id);
  try {
    const { warmDedicatedShards } = require('./services/db/shardRegistry');
    await warmDedicatedShards();
  } catch (err) {
    logger.warn({ err }, 'shard.warm.partial_failure');
  }
  lifecycle.mongoStartupComplete = true;
  lifecycle.mongoStartupError = null;
  logStartupPhase('mongo.startup.complete');
}

async function connectMongoForStartup() {
  const isDevManaged = process.env.LMS_DEV_MANAGED === '1';
  const maxAttempts = isDevManaged ? 12 : 1;
  const baseDelayMs = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await mongoose.connect(MONGODB_URI, mongoOptions);
      await runMongoStartupTasks();
      return;
    } catch (err) {
      lifecycle.mongoStartupComplete = false;
      lifecycle.mongoStartupError = err.message || String(err);

      if (mongoose.connection.readyState !== 0) {
        try {
          await mongoose.disconnect();
        } catch {
          /* ignore */
        }
      }

      if (attempt < maxAttempts) {
        const delayMs = Math.min(baseDelayMs * attempt, 15000);
        console.error(
          `❌ MongoDB connection failed (attempt ${attempt}/${maxAttempts}): ${err.message}`
        );
        console.error(`   Retrying in ${Math.round(delayMs / 1000)}s…`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      console.error('❌ MongoDB startup error:', err.message);
      mongoStartupEnvHint(err);
      process.exit(1);
    }
  }
}

// Under Jest the test harness owns the Mongo lifecycle (in-memory server +
// per-file waitForMongoConnection), so skip the app's own connect to avoid
// racing against a real .env URI (e.g. a paused Atlas cluster) during tests.
const mongoStartupPromise =
  process.env.NODE_ENV === 'test' ? Promise.resolve() : connectMongoForStartup();

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
  const relative = req.path.replace(/^\/+/, '');
  const isLegacyProfilePicture = /^profilePicture-\d+-\d+\.(jpe?g|png|gif|webp)$/i.test(relative);
  const isPublicAsset =
    relative.startsWith('public/') ||
    relative.startsWith('public\\') ||
    relative.startsWith('branding/') ||
    isLegacyProfilePicture;
  if (!isPublicAsset) {
    return res.status(403).json({
      message: 'Academic files require authentication. Use GET /api/files/:id/download',
    });
  }
  const filePath = path.join(__dirname, 'uploads', relative);
  if (fs.existsSync(filePath)) {
    uploadsStatic(req, res, next);
  } else if (isLegacyProfilePicture) {
    const { resolveProfilePictureRedirectUrl } = require('./utils/profilePictureUrl');
    resolveProfilePictureRedirectUrl(relative)
      .then((redirectUrl) => {
        if (redirectUrl) return res.redirect(302, redirectUrl);
        res.status(404).end();
      })
      .catch(() => res.status(404).end());
  } else {
    res.status(404).json({ message: 'File not found' });
  }
});

// Routes
app.use('/api', require('./middleware/tenant').resolveTenant);
app.use('/api', require('./middleware/tenantRateLimit').tenantRateLimit);
app.use('/api', require('./middleware/maintenanceMode'));
app.use('/api', require('./routes/platform.routes'));
app.use('/api/contact', contactInquiryLimiter, require('./routes/contact.routes'));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/auth', require('./routes/sso.routes'));
app.use('/api/catalog', require('./routes/catalog.routes'));
app.use('/api/courses', require('./routes/course.routes'));
app.use('/api/modules', require('./routes/module.routes'));
app.use('/api/pages', require('./routes/page.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/assignments', require('./routes/assignment.routes'));
app.use('/api/submissions', require('./routes/submission.routes'));
const discussionRouteMetrics = require('./middleware/discussionRouteMetrics');
app.use('/api/threads', discussionRouteMetrics('threads'), require('./routes/thread.routes'));
app.use('/api/replies', discussionRouteMetrics('replies'), require('./routes/reply.routes'));
app.use('/api/grades', require('./routes/grades.routes'));
app.use('/api/grading-policy', require('./routes/gradingPolicy.routes'));
app.use('/api/groups', require('./routes/groupRoutes'));
app.use('/api/announcements', require('./routes/announcement.routes'));
app.use('/api/events', require('./routes/event.routes'));
app.use('/api/calendar', require('./routes/calendar.routes'));
app.use('/api/todos', require('./routes/todo.routes'));
app.use('/api/planner', require('./routes/planner.routes').router);
app.use('/api/inbox', require('./routes/inbox.routes'));
app.use('/api', require('./routes/attendance.routes'));
app.use('/api/polls', require('./routes/poll.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/public', require('./routes/public.routes'));
app.use('/api/jobs', require('./routes/jobs.routes'));
app.use('/api/registrar/reports', require('./routes/registrarReports.routes'));
app.use('/api/registrar', require('./routes/registrar.routes'));
app.use('/api/ops', require('./routes/ops.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/academic', require('./routes/academic.routes'));
app.use('/api/academic-structure', require('./routes/academicStructure.routes'));
app.use('/api/notifications', require('./routes/notification.routes').router);
app.use('/api/quizwave', require('./routes/quizwave.routes'));
app.use('/api/integrations/zoho-meeting', require('./routes/zohoMeeting.routes'));
app.use('/api/integrations', require('./routes/integrations.routes'));
app.use('/api/files', require('./routes/file.routes'));

// Upload route for file uploads (staged FileAssets — Phase U3)
const upload = require('./middleware/upload');
const { protect } = require('./middleware/auth');
const fileAssetService = require('./services/fileAsset.service');

const chunkedUploadService = require('./services/chunkedUpload.service');
const expressRaw = express.raw({ type: 'application/octet-stream', limit: '10mb' });

app.post('/api/upload/chunk/init', protect, async (req, res) => {
  try {
    const { fileName, fileSize, mimeType, totalChunks, category, courseId, assignmentId } = req.body;
    if (!fileName || !fileSize || !totalChunks) {
      return res.status(400).json({ message: 'fileName, fileSize, and totalChunks required' });
    }
    const session = await chunkedUploadService.initSession({
      userId: req.user._id,
      fileName,
      fileSize: Number(fileSize),
      mimeType: mimeType || 'application/octet-stream',
      totalChunks: Number(totalChunks),
      category,
      courseId,
      assignmentId,
    });
    res.json({ success: true, ...session });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.get('/api/upload/chunk/:uploadId/status', protect, async (req, res) => {
  const status = chunkedUploadService.getSessionStatus(req.params.uploadId);
  if (!status) return res.status(404).json({ message: 'Session not found' });
  res.json({ success: true, ...status });
});

// Must be registered before /:chunkIndex — otherwise "complete" is parsed as a chunk index.
app.post('/api/upload/chunk/:uploadId/complete', protect, async (req, res) => {
  try {
    const asset = await chunkedUploadService.completeSession(req.params.uploadId, req.user, {
      ip: req.ip,
      requestId: req.requestId,
    });
    const downloadPath = fileAssetService.buildDownloadPathForUser(asset._id, req.user._id);
    res.json({
      success: true,
      files: [{
        originalname: asset.originalName,
        fileAssetId: asset._id.toString(),
        path: downloadPath,
        url: downloadPath,
        size: asset.size,
      }],
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.post('/api/upload/chunk/:uploadId/:chunkIndex', protect, expressRaw, async (req, res) => {
  try {
    const chunkIndex = Number(req.params.chunkIndex);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      return res.status(400).json({ message: 'Invalid chunk index' });
    }
    const progress = chunkedUploadService.saveChunk(
      req.params.uploadId,
      chunkIndex,
      req.body
    );
    res.json({ success: true, ...progress });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.post('/api/upload', protect, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const category = req.body.category || 'temporary';
    const courseId = req.body.courseId || null;
    const assignmentId = req.body.assignmentId || null;

    const fileQuotaService = require('./services/fileQuota.service');
    const totalBytes = req.files.reduce((sum, f) => sum + (f.size || 0), 0);
    await fileQuotaService.assertUploadWithinQuota({
      user: req.user,
      courseId,
      additionalBytes: totalBytes,
      audit: { ip: req.ip, requestId: req.requestId },
    });

    const assets = await fileAssetService.createFileAssetsFromMulter(req.files, {
      uploadedBy: req.user,
      category,
      visibility: category === 'profile' ? 'private' : 'private',
      accessScope: { ownerOnly: true },
      courseId: courseId || undefined,
      assignmentId: assignmentId || undefined,
      metadata: { ip: req.ip, requestId: req.requestId },
      skipLifecycleCheck: category === 'temporary' || category === 'profile' || category === 'feedback',
    });

    const files = assets.map((asset) => {
      const downloadPath = fileAssetService.buildDownloadPathForUser(asset._id, req.user._id);
      return {
        originalname: asset.originalName,
        filename: asset._id.toString(),
        path: downloadPath,
        url: downloadPath,
        fileAssetId: asset._id.toString(),
        size: asset.size,
        cloudinary: asset.provider === 'cloudinary',
      };
    });

    res.json({
      message: 'Files uploaded successfully',
      files,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Error uploading files' });
  }
});

// Report errors to Sentry before our own handlers format the response.
if (process.env.SENTRY_DSN) {
  require('@sentry/node').setupExpressErrorHandler(app);
}

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

app.get('/health/live', (req, res) => {
  res.json({ status: 'live', timestamp: new Date().toISOString() });
});

app.get('/health/dependencies', metricsAuth, async (req, res) => {
  const opsController = require('./controllers/ops.controller');
  return opsController.getDependenciesHealth(req, res);
});

app.get('/health/ready', async (req, res) => {
  const mongoConnected = mongoose.connection.readyState === 1;
  const mongoStartupComplete = lifecycle.mongoStartupComplete;
  const objectStorageReady = isCloudinaryConfigured();
  const objectStorageMode = objectStorageReady ? 'cloudinary' : 'local';
  const redisRequired = process.env.REQUIRE_REDIS === 'true';
  const objectStorageRequired = process.env.FORCE_OBJECT_STORAGE === 'true';
  const redisReady = redisAdapterEnabled || !redisRequired;
  const storageReady = objectStorageReady || !objectStorageRequired;
  const { isRedisConfigured } = require('./utils/bullmqConnection');
  const jobQueueRedisConfigured = isRedisConfigured();
  const jobQueueRequired = process.env.REQUIRE_JOB_QUEUE === 'true';
  const jobQueueReady = jobQueueRedisConfigured || !jobQueueRequired;
  const healthy = mongoConnected && mongoStartupComplete && redisReady && storageReady && jobQueueReady;

  const payload = {
    status: healthy ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      mongoConnected,
      mongoStartupComplete,
      redisAdapterEnabled,
      redisRequired,
      jobQueueRedisConfigured,
      jobQueueRequired,
      jobQueueReady,
      objectStorageReady,
      objectStorageMode,
      objectStorageRequired,
    },
    redisAdapterError,
    mongoStartupError: lifecycle.mongoStartupError,
    startupPhase: lifecycle.startupPhase,
    apiSchedulersEnabled: lifecycle.apiSchedulersEnabled,
    notes: {
      gradingWorker:
        jobQueueRedisConfigured && !process.env.DISABLE_EMBEDDED_JOB_WORKER
          ? 'Embedded with API (set DISABLE_EMBEDDED_JOB_WORKER=true to use a separate worker process)'
          : jobQueueRedisConfigured && process.env.NODE_ENV === 'production'
            ? 'Run npm run worker:grading-jobs alongside the API'
            : null,
      notificationFanoutWorker:
        jobQueueRedisConfigured && process.env.NODE_ENV === 'production'
          ? 'Run npm run worker:notification-fanout for async academic notifications'
          : null,
      fileScanWorker:
        jobQueueRedisConfigured && process.env.NODE_ENV === 'production'
          ? 'Run npm run worker:file-scan for durable virus scans'
          : null,
      nightlyOpsWorker:
        'Schedule npm run worker:nightly-ops -- --apply via cron (e.g. 03:00 UTC daily)',
      sisSyncWorker:
        'Schedule npm run worker:sis-sync -- --apply via cron (hourly or nightly per SisIntegrationConfig.schedule)',
      erpHoldRetryWorker:
        'Schedule npm run worker:erp-hold-retry via cron to drain failed ERP hold webhooks / DLQ',
      quizwaveCleanup:
        lifecycle.apiSchedulersEnabled
          ? null
          : 'Run npm run worker:quizwave-cleanup or set ENABLE_API_SCHEDULERS=true',
    },
  };

  res.status(healthy ? 200 : 503).json(payload);
});

app.get('/health/ops', metricsAuth, (req, res) => {
  res.json(buildHealthOpsPayload());
});

// Prometheus metrics — protected in production
app.get('/metrics', metricsAuth, (req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(renderPrometheusMetrics(buildHealthOpsPayload()));
});

if (process.env.NODE_ENV !== 'production') {
  // Dev-only test endpoint
  app.post('/api/test-post', (req, res) => {
    res.json({
      status: 'ok',
      message: 'POST request received',
      timestamp: new Date().toISOString(),
    });
  });
}

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, 'frontend', 'dist');
  const isBundledAssetRequest = (requestPath) =>
    requestPath.startsWith('/assets/') &&
    /\.(js|mjs|css|map|woff2?|ttf|svg|png|jpe?g|gif|webp|ico)$/i.test(requestPath);

  // Hashed bundles under /assets: 404 when missing (express.static fallthrough only calls next(), not our callback).
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.method !== 'GET') {
      return next();
    }
    if (isBundledAssetRequest(req.path)) {
      const assetPath = path.normalize(path.join(frontendDist, req.path));
      if (!assetPath.startsWith(frontendDist) || !fs.existsSync(assetPath)) {
        return res.status(404).type('text/plain').send('Not found');
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(assetPath, (err) => (err ? next(err) : undefined));
    }
    express.static(frontendDist, { maxAge: '1d' })(req, res, next);
  });

  // SPA shell: always revalidate so clients pick up new chunk hashes after deploy.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Final error handler for routes registered after the primary API error middleware
// (health, metrics, and production static handlers).
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  logger.error({ err, requestId: req.requestId }, 'request.unhandled_error');
  const message = process.env.NODE_ENV === 'production'
    ? 'Something went wrong!'
    : err.message;
  return res.status(err.status || 500).json({
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

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
    logger.warn({ err: error }, 'socket.io redis adapter unavailable; continuing in single-node mode');
  }
};

// Socket.IO + Redis are omitted under NODE_ENV=test so Jest workers can exit cleanly (HTTP routes still tested via supertest).
let io = null;
if (process.env.NODE_ENV !== 'test') {
  io = new Server(server, {
    cors: {
      origin:
        process.env.NODE_ENV === 'production' ? getProductionOrigins() : getDevOrigins(),
      credentials: true,
      methods: ['GET', 'POST'],
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
  initializeMessagingSocket(io.of('/messaging'));
  initializeNotificationSocket(io.of('/notifications'));

  if (process.env.QUIZWAVE_DISTRIBUTED_TIMERS !== 'false') {
    const { startQuizwaveTimerWorker } = require('./services/quizwaveTimerQueue.service');
    const quizwaveTimerWorker = startQuizwaveTimerWorker(io);
    if (quizwaveTimerWorker) {
      logger.info('quizwave.distributed_timer_worker.started');
    }
  }
}

let stopCleanupScheduler = null;

const startApiSchedulers = () => {
  if (!lifecycle.apiSchedulersEnabled) {
    logger.info(
      {
        enableWith: 'ENABLE_API_SCHEDULERS=true',
        workerCommand: 'npm run worker:quizwave-cleanup',
      },
      'api.schedulers.disabled'
    );
    return;
  }

  const cleanupScheduler = require('./utils/quizwaveCleanup');
  cleanupScheduler.startCleanupScheduler();
  stopCleanupScheduler = cleanupScheduler.stopCleanupScheduler;
  logger.info('api.schedulers.started');
};

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  const PORT = Number(process.env.PORT || 5000);

  const listenOnce = () =>
    new Promise((resolve, reject) => {
      const onError = (err) => {
        server.off('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        server.off('error', onError);
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(PORT);
    });

  const startServer = async () => {
    const managed = process.env.LMS_DEV_MANAGED === '1';
    const maxAttempts = managed ? 12 : 1;
    const { canBindPort, isPortAvailable } = require('./scripts/freePort');
    logStartupPhase('server.waiting_for_mongo');
    await mongoStartupPromise;
    logStartupPhase('server.listen.starting', { port: PORT, managed });

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (managed) {
        const bindReady =
          (await isPortAvailable(PORT)) ||
          (await canBindPort(PORT, '0.0.0.0'));
        if (!bindReady) {
          await new Promise((r) => setTimeout(r, 300 + attempt * 80));
          continue;
        }
      }

      try {
        await listenOnce();
        logStartupPhase('server.listening', { port: PORT });
        console.log(`✅ Server listening on http://localhost:${PORT}`);
        if (process.env.NODE_ENV === 'production') {
          try {
            const { getSecurityPosture } = require('./services/securityPosture.service');
            const posture = getSecurityPosture();
            logger.info(
              {
                phase: 'security.posture',
                summary: posture.summary,
                checks: posture.checks,
              },
              'security.posture.startup'
            );
          } catch (postureErr) {
            logger.warn({ err: postureErr }, 'security.posture.startup.failed');
          }
        }
        startApiSchedulers();
        const { startEmbeddedGradingWorkerIfNeeded } = require('./services/jobQueue.service');
        if (startEmbeddedGradingWorkerIfNeeded()) {
          console.log('✅ Background job worker started (embedded with API)');
        }
        return;
      } catch (err) {
        if (err.code !== 'EADDRINUSE' || attempt === maxAttempts) {
          if (err.code === 'EADDRINUSE') {
            console.error(`❌ Port ${PORT} is already in use. Run: npm run stop:dev`);
            console.error('   Then start a single terminal with: npm run dev');
          } else {
            console.error('❌ Server error:', err.message);
          }
          process.exit(1);
        }
        await new Promise((r) => setTimeout(r, 400 + attempt * 100));
      }
    }
  };

  void startServer();

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const forceTimer = setTimeout(() => process.exit(0), 5000);
    forceTimer.unref();

    const closeMongo = () =>
      mongoose.connection.readyState === 0
        ? Promise.resolve()
        : mongoose.connection.close(false).catch(() => {});

    const closeIo = () =>
      new Promise((resolve) => {
        if (!io) return resolve();
        io.close(() => resolve());
      });

    const closeHttp = () =>
      new Promise((resolve) => {
        if (!server.listening) return resolve();
        server.close(() => resolve());
      });

    logger.info({ signal }, 'shutdown.started');
    if (typeof stopCleanupScheduler === 'function') stopCleanupScheduler();
    const { closeGradingWorker } = require('./services/jobQueue.service');
    const closeWorker = () => closeGradingWorker().catch(() => {});

    closeWorker()
      .then(closeIo)
      .then(closeHttp)
      .then(closeMongo)
      .then(() => {
        clearTimeout(forceTimer);
        logger.info({ signal }, 'shutdown.complete');
        process.exit(0);
      })
      .catch((err) => {
        clearTimeout(forceTimer);
        logger.error({ err, signal }, 'shutdown.error');
        process.exit(0);
      });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Export app for testing
module.exports = app; 