const mongoose = require('mongoose');

// Quiz Model - Stores quiz templates
const quizSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course is required']
  },
  title: {
    type: String,
    required: [true, 'Quiz title is required'],
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  questions: [{
    questionText: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
      maxlength: 500
    },
    questionType: {
      type: String,
      enum: ['multiple-choice', 'true-false'],
      required: true,
      default: 'multiple-choice'
    },
    options: [{
      text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
      },
      isCorrect: {
        type: Boolean,
        default: false
      }
    }],
    timeLimit: {
      type: Number, // in seconds
      default: 30,
      min: 5,
      max: 300
    },
    points: {
      type: Number,
      default: 5
    },
    order: {
      type: Number,
      default: 0
    }
  }],
  settings: {
    showLeaderboard: {
      type: Boolean,
      default: true
    },
    showCorrectAnswer: {
      type: Boolean,
      default: true
    },
    maxSessionDuration: {
      type: Number, // in minutes
      default: 120,
      min: 5,
      max: 480
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// QuizSession Model - Stores active game sessions
const quizSessionSchema = new mongoose.Schema({
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuizWave',
    required: [true, 'Quiz is required']
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course is required']
  },
  gamePin: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'paused', 'ended'],
    default: 'waiting'
  },
  currentQuestionIndex: {
    type: Number,
    default: -1
  },
  startedAt: {
    type: Date
  },
  endedAt: {
    type: Date
  },
  participants: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    nickname: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    totalScore: {
      type: Number,
      default: 0
    },
    answers: [{
      questionIndex: {
        type: Number,
        required: true
      },
      selectedOptions: [{
        type: Number,
        required: true
      }],
      isCorrect: {
        type: Boolean,
        default: false
      },
      points: {
        type: Number,
        default: 0
      },
      timeTaken: {
        type: Number, // in milliseconds
        default: 0
      },
      answeredAt: {
        type: Date,
        default: Date.now
      }
    }]
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  }
}, {
  timestamps: true
});

// Index for cleanup queries
quizSessionSchema.index({ createdAt: 1 });
quizSessionSchema.index({ status: 1, createdAt: 1 });

// Method to generate unique game PIN
// Simplified, bulletproof approach
quizSessionSchema.statics.generateGamePin = async function() {
  console.log('[generateGamePin] Starting PIN generation...');
  
  try {
    // Get count of existing sessions for logging
    const sessionCount = await this.countDocuments({}).catch(err => {
      console.warn('[generateGamePin] Could not count sessions:', err.message);
      return 0;
    });
    console.log(`[generateGamePin] Total sessions in database: ${sessionCount}`);
    
    // Simple approach: Generate random 6-digit PIN and check if it exists
    // With only 1 session in DB, this should work on first try
    let pin;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10; // Should be more than enough
    
    while (!isUnique && attempts < maxAttempts) {
      attempts++;
      
      // Generate simple random 6-digit PIN
      pin = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`[generateGamePin] Attempt ${attempts}: Generated PIN ${pin}`);
      
      try {
        // Check if PIN exists - use select('_id') for minimal data transfer
        const existing = await this.findOne({ gamePin: pin }).select('_id').lean().maxTimeMS(5000);
        
        if (!existing) {
          isUnique = true;
          console.log(`[generateGamePin] ✅ Success! Unique PIN found: ${pin} (after ${attempts} attempts)`);
        } else {
          console.log(`[generateGamePin] PIN ${pin} already exists, trying again...`);
        }
      } catch (dbError) {
        console.error(`[generateGamePin] ❌ Database error on attempt ${attempts}:`, {
          name: dbError.name,
          message: dbError.message,
          code: dbError.code
        });
        
        // If it's a timeout, try again
        if (dbError.name === 'MongoTimeoutError' || dbError.message.includes('timeout')) {
          console.log('[generateGamePin] Database timeout, retrying...');
          continue;
        }
        
        // For other errors, throw after a few attempts
        if (attempts >= 3) {
          throw new Error(`Database error while checking PIN: ${dbError.message}`);
        }
      }
    }
    
    if (!isUnique) {
      // Last resort: Use timestamp-based PIN (guaranteed unique per millisecond)
      console.warn('[generateGamePin] Random method failed, using timestamp fallback...');
      const now = Date.now();
      // Use last 6 digits of timestamp
      let timestampPin = (now % 1000000).toString();
      
      // Ensure it's 6 digits
      while (timestampPin.length < 6) {
        timestampPin = '0' + timestampPin;
      }
      
      // Check if this timestamp PIN exists
      try {
        const existing = await this.findOne({ gamePin: timestampPin }).select('_id').lean();
        if (!existing) {
          console.log(`[generateGamePin] ✅ Timestamp fallback succeeded: ${timestampPin}`);
          return timestampPin;
        }
        
        // If timestamp PIN exists, add a random offset
        const offset = Math.floor(Math.random() * 1000);
        const finalPin = ((parseInt(timestampPin) + offset) % 900000 + 100000).toString();
        const finalCheck = await this.findOne({ gamePin: finalPin }).select('_id').lean();
        if (!finalCheck) {
          console.log(`[generateGamePin] ✅ Final fallback succeeded: ${finalPin}`);
          return finalPin;
        }
      } catch (fallbackError) {
        console.error('[generateGamePin] ❌ Fallback also failed:', fallbackError.message);
      }
      
      console.error(`[generateGamePin] ❌ FAILED: Could not generate unique PIN after ${maxAttempts} attempts + fallback`);
      throw new Error(`Failed to generate unique game PIN. Please check database connection.`);
    }
    
    return pin;
  } catch (error) {
    console.error('[generateGamePin] ❌ Fatal error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
};

// Method to check if session should be cleaned up (older than 2 days)
quizSessionSchema.methods.shouldCleanup = function() {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  return this.createdAt < twoDaysAgo && this.status === 'ended';
};

// Virtual for participant count
quizSessionSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

// QuizResponse Model - Detailed response tracking (optional, for analytics)
const quizResponseSchema = new mongoose.Schema({
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuizSession',
    required: true
  },
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuizWave',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  questionIndex: {
    type: Number,
    required: true
  },
  selectedOptions: [{
    type: Number,
    required: true
  }],
  isCorrect: {
    type: Boolean,
    default: false
  },
  points: {
    type: Number,
    default: 0
  },
  timeTaken: {
    type: Number, // in milliseconds
    required: true
  },
  answeredAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
quizResponseSchema.index({ session: 1, student: 1 });
quizResponseSchema.index({ quiz: 1, student: 1 });

const QuizWave = mongoose.model('QuizWave', quizSchema);
const QuizSession = mongoose.model('QuizSession', quizSessionSchema);
const QuizResponse = mongoose.model('QuizResponse', quizResponseSchema);

module.exports = {
  QuizWave,
  QuizSession,
  QuizResponse
};

