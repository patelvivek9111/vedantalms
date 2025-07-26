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

// Middleware
app.use(cors());
app.use(express.json());

// Add request logging
app.use((req, res, next) => {

  next();
});

app.use((req, res, next) => {
  next();
});

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
  dbName: 'lms'
};

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
mongoose.connect(MONGODB_URI, mongoOptions)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if cannot connect to database
  });

// Serve uploads directory for profile pictures and other files
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
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
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// API route not found handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 