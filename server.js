const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

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
app.use('/uploads', express.static('uploads'));

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

// Upload route for file uploads
const upload = require('./middleware/upload');
const { protect } = require('./middleware/auth');
app.post('/api/upload', protect, upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }
    
    const files = req.files.map(file => ({
      originalname: file.originalname,
      filename: file.filename,
      path: `/uploads/${file.filename}`,
      size: file.size
    }));
    
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
  res.status(404).json({ message: 'API route not found', path: req.path });
});

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the frontend/dist directory
  app.use(express.static(path.join(__dirname, 'frontend', 'dist')));
  
  // Handle all non-API routes by serving the frontend (must be last)
  app.get('*', (req, res, next) => {
    // Don't serve frontend for API routes
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
  });
}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
}); 