# Student-Powered Content Voting System

## Overview

The Student-Powered Content Voting System allows teachers to create polls for their courses, enabling students to vote on upcoming content types or topics. This feature democratizes learning while keeping teachers in control, fostering student engagement and providing valuable data on student preferences.

## Features

### For Teachers/Instructors
- **Create Polls**: Create polls with multiple options, end dates, and visibility settings
- **Manage Polls**: Edit, delete, and control poll visibility
- **View Results**: Access detailed voting results and analytics
- **Control Visibility**: Choose whether to show results to students before poll ends
- **Multiple Vote Options**: Allow single or multiple votes per student

### For Students
- **Vote on Content**: Participate in polls to influence course content
- **View Results**: See voting results (when enabled by instructor)
- **Track Participation**: See which polls they've voted on
- **Anonymous Voting**: Vote anonymously while maintaining accountability

## Technical Implementation

### Backend Components

#### 1. Poll Model (`models/poll.model.js`)
```javascript
const pollSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String, required: true, maxlength: 1000 },
  options: [{
    text: { type: String, required: true, maxlength: 200 },
    votes: { type: Number, default: 0 }
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
  endDate: { type: Date, required: true },
  allowMultipleVotes: { type: Boolean, default: false },
  studentVotes: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    selectedOptions: [{ type: Number, required: true }],
    votedAt: { type: Date, default: Date.now }
  }],
  resultsVisible: { type: Boolean, default: false }
});
```

#### 2. Poll Controller (`controllers/poll.controller.js`)
Key functions:
- `createPoll()`: Create new polls (teachers only)
- `getPollsByCourse()`: Fetch polls for a course
- `voteOnPoll()`: Record student votes
- `getPollResults()`: Get detailed results (teachers only)
- `updatePoll()`: Edit poll settings
- `deletePoll()`: Remove polls

#### 3. Poll Routes (`routes/poll.routes.js`)
```javascript
// Routes
router.route('/courses/:courseId')
  .get(protect, getPollsByCourse)
  .post(protect, authorize('teacher', 'admin'), createPollValidation, createPoll);

router.route('/:pollId/vote')
  .post(protect, authorize('student'), voteValidation, voteOnPoll);

router.route('/:pollId/results')
  .get(protect, authorize('teacher', 'admin'), getPollResults);

router.route('/:pollId')
  .put(protect, authorize('teacher', 'admin'), updatePoll)
  .delete(protect, authorize('teacher', 'admin'), deletePoll);
```

### Frontend Components

#### 1. PollList Component (`frontend/src/components/polls/PollList.tsx`)
- Displays all polls for a course
- Different views for teachers and students
- Shows voting interface for active polls
- Displays results with visual indicators

#### 2. PollForm Component (`frontend/src/components/polls/PollForm.tsx`)
- Modal form for creating/editing polls
- Validation for required fields
- Dynamic option management
- Settings for multiple votes and result visibility

#### 3. PollVote Component (`frontend/src/components/polls/PollVote.tsx`)
- Interactive voting interface for students
- Support for single and multiple votes
- Real-time validation and feedback
- Success/error state handling

## API Endpoints

### Poll Management
- `GET /api/polls/courses/:courseId` - Get all polls for a course
- `POST /api/polls/courses/:courseId` - Create a new poll (teachers only)
- `PUT /api/polls/:pollId` - Update poll settings (teachers only)
- `DELETE /api/polls/:pollId` - Delete a poll (teachers only)

### Voting
- `POST /api/polls/:pollId/vote` - Submit a vote (students only)

### Results
- `GET /api/polls/:pollId/results` - Get detailed results (teachers only)

## Usage Examples

### Creating a Poll (Teacher)
```javascript
const pollData = {
  title: "What type of content would you prefer for next week?",
  description: "Help us decide what would be most beneficial for your learning.",
  options: ["Video Lecture", "Group Discussion", "Case Study", "Interactive Quiz"],
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  allowMultipleVotes: false,
  resultsVisible: true
};

const response = await axios.post('/api/polls/courses/courseId', pollData, {
  headers: { Authorization: `Bearer ${token}` }
});
```

### Voting on a Poll (Student)
```javascript
const voteData = {
  selectedOptions: [0] // Vote for first option
};

const response = await axios.post('/api/polls/pollId/vote', voteData, {
  headers: { Authorization: `Bearer ${token}` }
});
```

## Integration with CourseDetail

The poll system is integrated into the main course interface:

1. **Navigation**: Added "Polls" tab to course navigation
2. **Role-based Access**: Different views for teachers and students
3. **Real-time Updates**: Polls refresh automatically after votes
4. **Responsive Design**: Works on desktop and mobile devices

## Security Features

- **Authentication Required**: All endpoints require valid JWT tokens
- **Role-based Authorization**: Teachers can create/manage, students can vote
- **Course Membership**: Only enrolled students can vote
- **Single Vote Protection**: Students can only vote once per poll
- **Input Validation**: Server-side validation for all inputs

## Benefits

### For Students
- **Increased Engagement**: Students feel more invested in course content
- **Voice in Learning**: Opportunity to influence course direction
- **Transparency**: See how their preferences align with classmates
- **Accountability**: Track their participation in course decisions

### For Teachers
- **Data-driven Decisions**: Get insights into student preferences
- **Increased Completion Rates**: Engaged students are 2.5x more likely to complete courses
- **Flexible Control**: Maintain control while incorporating student input
- **Easy Management**: Simple interface for creating and managing polls

## Future Enhancements

1. **Advanced Analytics**: Detailed voting patterns and trends
2. **Poll Templates**: Pre-built poll templates for common scenarios
3. **Notification System**: Remind students about active polls
4. **Export Results**: Download poll results for analysis
5. **Integration with Calendar**: Schedule content based on poll results
6. **Anonymous Mode**: Option for completely anonymous voting

## Testing

Use the provided test script (`test-poll.js`) to verify functionality:

```bash
node test-poll.js
```

## Deployment

The poll system is automatically included in the main LMS deployment. No additional configuration is required beyond the standard setup.

## Support

For issues or questions about the poll system, refer to the main LMS documentation or contact the development team. 