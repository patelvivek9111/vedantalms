const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

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
    
    // Check if origin is in allowed list
    // Note: Wildcard patterns like .onrender.com are security risks - only allow specific origins
    const isAllowed = allowedOrigins.includes(origin);
    
    // In development, allow localhost with any port
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Security headers middleware
app.use((req, res, next) => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (basic)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;");
  }
  
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');
  
  next();
});

// Enforce HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Check if request is secure (HTTPS)
    if (req.header('x-forwarded-proto') !== 'https' && !req.secure) {
      // Allow health check endpoint without HTTPS
      if (req.path === '/health') {
        return next();
      }
      // Redirect to HTTPS
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Set default JWT secret if not in environment
process.env.JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-123';
process.env.JWT_EXPIRE = process.env.JWT_EXPIRE || '30d';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// MongoDB connection options
const mongoOptions = {
  dbName: 'lms',
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
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
    console.warn('⚠️  Warning: Found MongoDB URI embedded in string, extracting it...');
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
  .then(() => {
    console.log('✅ Connected to MongoDB');
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Log connection details (without password)
    const connection = mongoose.connection;
    const dbName = connection.db.databaseName;
    const host = connection.host;
    const port = connection.port;
    
    // Extract cluster name from URI if it's Atlas
    let clusterInfo = '';
    if (MONGODB_URI.includes('mongodb+srv://')) {
      const clusterMatch = MONGODB_URI.match(/@([^.]+)\.mongodb\.net/);
      if (clusterMatch) {
        clusterInfo = ` (Cluster: ${clusterMatch[1]})`;
      }
    }
    
    console.log(`📊 Database: ${dbName}`);
    console.log(`🔗 Connection: ${host}${port ? ':' + port : ''}${clusterInfo}`);
    console.log(`📝 MongoDB URI: ${MONGODB_URI.replace(/:[^:@]+@/, ':****@')}`); // Hide password
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('Please check your MONGODB_URI environment variable in Render dashboard.');
    process.exit(1); // Exit if cannot connect to database
  });

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
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

// Upload route for file uploads
const upload = require('./middleware/upload');
const { protect } = require('./middleware/auth');
const { uploadMultipleToCloudinary, uploadToCloudinary, isCloudinaryConfigured } = require('./utils/cloudinary');

// Proxy endpoint for Cloudinary files (to avoid CORS and 401 issues)
app.get('/api/files/proxy', async (req, res) => {
  try {
    const fileUrl = req.query.url;
    if (!fileUrl) {
      return res.status(400).json({ message: 'File URL is required' });
    }

    // Only allow Cloudinary URLs for security (prevent SSRF attacks)
    if (!fileUrl.includes('cloudinary.com') && !fileUrl.startsWith('/uploads/')) {
      return res.status(400).json({ message: 'Invalid file URL' });
    }
    
    // Additional SSRF protection: validate Cloudinary URL format
    if (fileUrl.includes('cloudinary.com')) {
      // Ensure it's a valid Cloudinary URL (res.cloudinary.com)
      if (!fileUrl.includes('res.cloudinary.com') && !fileUrl.includes('api.cloudinary.com')) {
        return res.status(400).json({ message: 'Invalid Cloudinary URL format' });
      }
      // Prevent accessing internal/private IPs through Cloudinary
      if (fileUrl.match(/localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
        return res.status(400).json({ message: 'Invalid file URL' });
      }
    }

    const https = require('https');
    const http = require('http');
    const url = require('url');

    // Handle relative URLs (e.g., /uploads/file.pdf)
    let parsedUrl;
    try {
      // If it's a relative URL, construct absolute URL
      if (fileUrl.startsWith('/uploads/')) {
        // For local files, serve directly without proxy
        const filePath = path.join(__dirname, fileUrl);
        if (fs.existsSync(filePath)) {
          return res.sendFile(filePath);
        } else {
          return res.status(404).json({ message: 'File not found' });
        }
      }
      parsedUrl = new URL(fileUrl);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid file URL format' });
    }
    const client = parsedUrl.protocol === 'https:' ? https : http;

    client.get(fileUrl, (response) => {
      if (response.statusCode === 200) {
        // Set appropriate headers
        const contentType = response.headers['content-type'] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', response.headers['content-disposition'] || 'inline');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Pipe the response
        response.pipe(res);
      } else if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirects
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          return res.status(500).json({ message: 'Redirect location not provided' });
        }
        
        // Handle relative redirects by resolving against the original URL
        let absoluteRedirectUrl;
        try {
          if (redirectUrl.startsWith('http://') || redirectUrl.startsWith('https://')) {
            absoluteRedirectUrl = redirectUrl;
          } else {
            // Relative redirect - resolve against original URL
            absoluteRedirectUrl = new URL(redirectUrl, fileUrl).href;
          }
          const redirectParsed = new URL(absoluteRedirectUrl);
          const redirectClient = redirectParsed.protocol === 'https:' ? https : http;
        
        redirectClient.get(absoluteRedirectUrl, (redirectResponse) => {
          if (redirectResponse.statusCode === 200) {
            const contentType = redirectResponse.headers['content-type'] || 'application/octet-stream';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', redirectResponse.headers['content-disposition'] || 'inline');
            res.setHeader('Access-Control-Allow-Origin', '*');
            redirectResponse.pipe(res);
          } else {
            res.status(redirectResponse.statusCode).json({ 
              message: 'Failed to fetch file',
              statusCode: redirectResponse.statusCode,
              hint: redirectResponse.statusCode === 401 ? 'File is not publicly accessible. Run: node scripts/fixCloudinaryAccess.js' : undefined
            });
          }
        }).on('error', (err) => {
          console.error('Proxy error:', err);
          res.status(500).json({ message: 'Error fetching file' });
        });
        } catch (redirectErr) {
          console.error('Proxy error: Invalid redirect URL:', redirectErr);
          res.status(500).json({ message: 'Error processing redirect URL' });
        }
      } else if (response.statusCode === 401) {
        // File is not publicly accessible
        console.error('[Proxy] 401 Unauthorized for file:', fileUrl);
        res.status(401).json({ 
          message: 'File is not publicly accessible',
          hint: 'The file needs to be made public in Cloudinary. Run: node scripts/fixCloudinaryAccess.js'
        });
      } else {
        res.status(response.statusCode).json({ 
          message: 'Failed to fetch file',
          statusCode: response.statusCode
        });
      }
    }).on('error', (err) => {
      console.error('Proxy error:', err);
      res.status(500).json({ message: 'Error fetching file' });
    });
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ message: 'Error processing request' });
  }
});

app.post('/api/upload', protect, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }
    
    let files;
    
    // Use Cloudinary if configured, otherwise use local storage
    if (isCloudinaryConfigured()) {
      try {
        console.log('[Upload] Starting Cloudinary upload for', req.files.length, 'file(s)');
        
        // Upload files with appropriate resource_type
        const uploadPromises = req.files.map(async (file, index) => {
          // Determine resource_type based on file MIME type
          let resourceType = 'auto';
          if (file.mimetype.startsWith('image/')) {
            resourceType = 'image';
          } else if (file.mimetype.startsWith('video/')) {
            resourceType = 'video';
          } else {
            // For PDFs, documents, etc., use 'raw'
            resourceType = 'raw';
          }
          
          console.log(`[Upload] File ${index + 1}:`, {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            resourceType: resourceType,
            path: file.path
          });
          
          try {
            const result = await uploadToCloudinary(file, {
              folder: 'lms/uploads',
              resource_type: resourceType
            });
            
            console.log(`[Upload] File ${index + 1} uploaded successfully:`, {
              url: result.url,
              public_id: result.public_id,
              resource_type: result.resource_type,
              bytes: result.bytes
            });
            
            return { success: true, result, index };
          } catch (uploadError) {
            console.error(`[Upload] Error uploading file ${index + 1}:`, uploadError);
            // Return error info instead of throwing, so other files can still upload
            return { success: false, error: uploadError.message, file: file.originalname, index };
          }
        });
        
        const uploadResults = await Promise.all(uploadPromises);
        
        // Separate successful and failed uploads
        const cloudinaryResults = uploadResults.filter(r => r.success).map(r => r.result);
        const failedUploads = uploadResults.filter(r => !r.success);
        
        // Log failed uploads
        if (failedUploads.length > 0) {
          console.error('[Upload] Some files failed to upload:', failedUploads);
          // If all files failed, throw error
          if (cloudinaryResults.length === 0) {
            throw new Error(`All files failed to upload: ${failedUploads.map(f => f.error).join('; ')}`);
          }
        }
        
        // Clean up local files after successful Cloudinary uploads
        // Note: uploadToCloudinary already deletes files, but we'll ensure cleanup for any edge cases
        const fsPromises = require('fs').promises;
        for (const result of uploadResults) {
          if (result.success && result.index !== undefined) {
            const file = req.files[result.index];
            if (file && file.path) {
              try {
                await fsPromises.unlink(file.path);
                console.log('[Upload] Cleaned up local file after Cloudinary upload:', file.path);
              } catch (err) {
                // File might already be deleted by uploadToCloudinary, ignore error
                console.log('[Upload] Local file already cleaned up or not found:', file.path);
              }
            }
          }
        }
        
        console.log('[Upload] All files uploaded successfully:', cloudinaryResults.length);
        
        // Map results preserving original file order
        files = uploadResults
          .filter(r => r.success)
          .map(r => {
            const originalFile = req.files[r.index];
            const result = r.result;
            const fileData = {
              originalname: originalFile.originalname,
              filename: result.public_id.split('/').pop(),
              path: result.url, // Cloudinary URL
              size: result.bytes,
              cloudinary: true,
              resource_type: result.resource_type,
              public_id: result.public_id
            };
            
            // Log file data for debugging
            console.log(`[Upload] File ${r.index + 1} data:`, {
              originalname: fileData.originalname,
              url: fileData.path,
              resource_type: fileData.resource_type,
              public_id: fileData.public_id,
              size: fileData.size
            });
            
            return fileData;
          });
        
        console.log('[Upload] Returning file data:', files.map(f => ({ 
          name: f.originalname, 
          url: f.path, 
          resource_type: f.resource_type 
        })));
      } catch (cloudinaryError) {
        console.error('[Upload] Cloudinary upload failed, falling back to local storage:', cloudinaryError);
        console.error('[Upload] Error details:', {
          message: cloudinaryError.message,
          stack: cloudinaryError.stack
        });
        // Fallback to local storage
        files = req.files.map(file => ({
          originalname: file.originalname,
          filename: file.filename,
          path: `/uploads/${file.filename}`,
          size: file.size,
          cloudinary: false
        }));
      }
    } else {
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

// Error handling middleware (must be after all routes)
app.use((err, req, res, next) => {
  // Log error details (but don't expose to client in production)
  console.error('❌ Error:', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error('Stack:', err.stack);
  }
  
  // Handle Multer errors specifically
  if (err.name === 'MulterError') {
    let message = 'File upload error';
    let status = 400;
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large. Maximum file size is 10MB.';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Maximum file count exceeded.';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field.';
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Too many parts in the request.';
        break;
      default:
        message = `File upload error: ${err.message}`;
    }
    
    return res.status(status).json({ 
      success: false,
      message,
      error: err.code
    });
  }
  
  // Handle file filter errors
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ 
      success: false,
      message: err.message
    });
  }
  
  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong!' 
    : err.message;
    
  res.status(err.status || 500).json({ 
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// API route not found handler (must be after all API routes but before static files)
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'API route not found', path: req.path });
});

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the frontend/dist directory
  app.use(express.static(path.join(__dirname, 'frontend', 'dist')));
  
  // Handle all non-API routes by serving the frontend (must be last)
  app.get('*', (req, res, next) => {
    // Don't serve frontend for API routes or uploads
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
  });
}

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.FRONTEND_URL || 'https://vedantaed.com', 'https://www.vedantaed.com']
      : ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Initialize QuizWave socket handlers
const { initializeQuizWaveSocket } = require('./socket/quizwave.socket');
initializeQuizWaveSocket(io);

console.log('✅ Socket.io initialized for QuizWave');

// Start QuizWave auto-cleanup scheduler
const { startCleanupScheduler } = require('./utils/quizwaveCleanup');
startCleanupScheduler();

// Start server (only if not in test environment)
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🎮 QuizWave Socket.io ready`);
  });
} else {
  // In test environment, server is not started
  // Export app for Supertest (which requires Express app, not HTTP server)
}

// Graceful shutdown (only register if server is started)
if (process.env.NODE_ENV !== 'test') {
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    io.close(() => {
      mongoose.connection.close(() => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
      });
    });
  });

  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    io.close(() => {
      mongoose.connection.close(() => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
      });
    });
  });
}

// Export Express app for testing with Supertest
// Supertest requires the Express app instance, not the HTTP server
// In test environment: app is exported, server is not started
// In production: app is exported, server is started and listening
module.exports = app;