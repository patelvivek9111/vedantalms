# 📚 Vedanta LMS - Learning Management System

A comprehensive, modern Learning Management System built with React, Node.js, Express, and MongoDB. Designed for educational institutions to manage courses, assignments, students, and administrative tasks efficiently.

## 🌟 Overview

Vedanta LMS is a full-featured learning management platform that enables educators to create engaging courses, manage student enrollments, track progress, and facilitate collaboration. Students can access course materials, submit assignments, participate in discussions, and track their academic progress.

**Live URL**: [vedantaed.com](https://vedantaed.com)

---

## ✨ Key Features

### 🎓 Course Management
- **Course Creation & Customization**
  - Create courses with detailed descriptions, syllabi, and metadata
  - Customizable course navigation sidebar
  - Course visibility controls (public/private)
  - Semester and term management
  - Course code and credit hours tracking

- **Module Organization**
  - Organize course content into modules
  - Drag-and-drop module reordering
  - Module-level content management
  - Lock/unlock modules for sequential learning

- **Rich Content Pages**
  - Rich text editor with formatting options
  - Markdown support
  - Image and file embedding
  - Page-level permissions

### 📝 Assignment Management
- **Individual Assignments**
  - Create assignments with due dates
  - Multiple question types: text, multiple-choice, matching
  - File attachments support
  - Assignment visibility controls
  - Publish/unpublish assignments

- **Group Assignments**
  - Assign assignments to student groups
  - Group-based submission tracking
  - Collaborative assignment management

- **Submission Handling**
  - File upload support
  - Multiple submission attempts
  - Late submission tracking
  - Submission status monitoring

### 📊 Grading & Assessment
- **Flexible Grading System**
  - Multiple grading schemes (points, percentages, letter grades)
  - Weighted grade calculations
  - Category-based grading (assignments, quizzes, discussions, etc.)
  - Custom grade scales

- **Gradebook**
  - Comprehensive gradebook view
  - Student grade overview
  - What-if score calculator
  - Grade export functionality

- **Transcript System**
  - Student academic transcript
  - Semester-wise grade tracking
  - GPA calculation
  - Credit hours tracking

### 👥 Student Management
- **Enrollment System**
  - Student search and enrollment
  - Enrollment approval workflow
  - Bulk enrollment support
  - Unenrollment capabilities

- **Student Profiles**
  - Profile pictures and personal information
  - Academic history tracking
  - Performance analytics

### 💬 Collaboration & Communication
- **Discussion Forums**
  - Threaded discussions
  - Course and module-level discussions
  - Reply and like functionality
  - Thread pinning
  - Discussion grading

- **Group Projects**
  - Create and manage student groups
  - Group sets for multiple projects
  - Group discussion boards
  - Group pages and announcements
  - Group assignment management

- **Messaging System**
  - Inbox for direct messages
  - Conversation threads
  - Unread message tracking
  - Real-time notifications

### 📢 Announcements & Polls
- **Announcements**
  - Course-wide announcements
  - Pin important announcements
  - Rich text formatting
  - Date-based filtering

- **Polls**
  - Create interactive polls
  - Student voting
  - Real-time results
  - Poll analytics

### 📅 Calendar & Events
- **Integrated Calendar**
  - View all assignments and events
  - Due date tracking
  - Event creation and management
  - Calendar export

### ✅ Attendance Tracking
- **Digital Attendance**
  - Mark attendance for course sessions
  - Date-based attendance records
  - Attendance statistics
  - Export attendance reports

### 📋 Task Management
- **To-Do Lists**
  - Personal task management
  - Course-specific tasks
  - Due date reminders
  - Task completion tracking

### 🔍 Course Catalog
- **Public Course Discovery**
  - Browse available courses
  - Course search and filtering
  - Course details and enrollment
  - Category-based browsing

### 👨‍💼 Administrative Features
- **Admin Dashboard**
  - System-wide analytics
  - User statistics
  - Course statistics
  - System health monitoring
  - Storage usage tracking

- **User Management**
  - Create and manage user accounts
  - Role assignment (Admin, Teacher, Student)
  - User search and filtering
  - Bulk user operations
  - Login activity tracking

- **Course Oversight**
  - View all courses in the system
  - Course analytics and statistics
  - Course management controls
  - Teacher course oversight

- **System Settings**
  - General settings (site name, description)
  - Security settings (password policies, session timeout)
  - Email configuration
  - Storage settings
  - Maintenance mode

- **Reports & Analytics**
  - Student performance reports
  - Course completion reports
  - Enrollment statistics
  - Grade distribution reports
  - Export to CSV

- **Security Management**
  - Login activity monitoring
  - Security audit logs
  - Password policy enforcement
  - Session management

---

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Routing
- **Tailwind CSS** - Styling
- **React Redux** - State management
- **Axios** - HTTP client
- **React Quill** - Rich text editor
- **TinyMCE** - Advanced text editor
- **TipTap** - Modern rich text editor
- **React Big Calendar** - Calendar component
- **Lucide React** - Icons
- **React Toastify** - Notifications

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **Multer** - File uploads
- **Express Validator** - Input validation
- **CORS** - Cross-origin resource sharing

### Infrastructure
- **MongoDB Atlas** - Cloud database
- **Railway/Render** - Hosting (backend)
- **Vercel** - Hosting (frontend)
- **Cloudinary** - File storage (optional)

---

## 📁 Project Structure

```
lms/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   ├── pages/           # Page components
│   │   ├── context/         # React context providers
│   │   ├── services/        # API service layer
│   │   ├── hooks/           # Custom React hooks
│   │   ├── utils/           # Utility functions
│   │   └── config.ts        # Configuration
│   └── dist/                # Production build output
├── controllers/             # Express route controllers
├── models/                  # Mongoose data models
├── routes/                  # Express route definitions
├── middleware/             # Express middleware (auth, upload)
├── utils/                   # Utility functions
├── uploads/                # File upload directory
├── server.js               # Express server entry point
└── package.json           # Node.js dependencies
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/lms.git
   cd lms
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/lms
   JWT_SECRET=your-super-secret-jwt-key-123
   JWT_EXPIRE=30d
   PORT=5000
   NODE_ENV=development
   ```

5. **Start the development servers**
   
   Backend (from root):
   ```bash
   npm run dev
   ```
   
   Frontend (from root):
   ```bash
   cd frontend
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

---

## 👤 User Roles

### Admin
- Full system access
- User management
- Course oversight
- System settings
- Analytics and reports
- Security management

### Teacher
- Create and manage courses
- Enroll/unenroll students
- Create assignments and grade submissions
- Manage course content (modules, pages)
- Track student progress
- Generate reports

### Student
- Enroll in courses
- View course content
- Submit assignments
- Participate in discussions
- View grades and transcripts
- Access calendar and events

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `GET /api/auth/login-activity` - Login activity history

### Courses
- `GET /api/courses` - Get all courses
- `POST /api/courses` - Create course
- `GET /api/courses/:id` - Get course details
- `PUT /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course
- `POST /api/courses/:id/enrollment` - Enroll student
- `POST /api/courses/:id/unenroll` - Unenroll student

### Assignments
- `GET /api/assignments` - Get assignments
- `POST /api/assignments` - Create assignment
- `GET /api/assignments/:id` - Get assignment details
- `PUT /api/assignments/:id` - Update assignment
- `DELETE /api/assignments/:id` - Delete assignment
- `POST /api/assignments/:id/publish` - Publish assignment

### Submissions
- `POST /api/submissions` - Submit assignment
- `GET /api/submissions/assignment/:id` - Get submissions for assignment
- `GET /api/submissions/student/:id` - Get student submissions
- `PUT /api/submissions/:id/grade` - Grade submission

### Grades
- `GET /api/grades/course/:id` - Get course grades
- `GET /api/grades/student/:id` - Get student grades
- `POST /api/grades` - Create grade entry
- `PUT /api/grades/:id` - Update grade

### Discussions
- `GET /api/threads` - Get discussion threads
- `POST /api/threads` - Create thread
- `GET /api/threads/:id` - Get thread details
- `POST /api/threads/:id/replies` - Reply to thread

### Groups
- `GET /api/groups` - Get groups
- `POST /api/groups` - Create group
- `GET /api/groups/:id` - Get group details
- `POST /api/groups/:id/members` - Add member to group

### Admin
- `GET /api/admin/users` - Get all users
- `GET /api/admin/courses` - Get all courses
- `GET /api/admin/analytics` - Get system analytics
- `GET /api/reports/*` - Various report endpoints

---

## 🔐 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (RBAC)
- CORS configuration
- Input validation
- File upload restrictions
- Session timeout management
- Login activity tracking

---

## 📦 Deployment

### Production Deployment
The application is configured for deployment on:
- **Railway** (recommended for all-in-one)
- **Vercel** (frontend) + **Render** (backend) - free option
- **Render** (all-in-one)

See deployment configuration in `railway.json` and environment variable setup in `env.example`.

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-very-long-random-secret
FRONTEND_URL=https://vedantaed.com
VITE_API_URL=https://vedantaed.com/api
```

---

## 🧪 Development

### Available Scripts

**Root directory:**
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run build` - Build frontend
- `npm run build:frontend` - Build frontend only

**Frontend directory:**
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

---

## 📝 Data Models

### User
- Authentication credentials
- Profile information
- Role (admin, teacher, student)
- Preferences
- Login activity

### Course
- Basic information (title, description, code)
- Enrollment lists
- Module organization
- Settings and configuration
- Sidebar customization

### Module
- Course association
- Content pages
- Order and visibility

### Assignment
- Assignment details
- Due dates
- Questions and answers
- Group assignment support
- Grading criteria

### Submission
- Student submissions
- Files and attachments
- Grading information
- Submission status

### Grade
- Grade entries
- Weighted calculations
- Category organization
- Student and course association

---

## 🎨 UI/UX Features

- Responsive design (mobile, tablet, desktop)
- Modern, clean interface
- Dark mode support (if implemented)
- Drag-and-drop functionality
- Real-time updates
- Loading states and error handling
- Toast notifications
- Modal dialogs
- Sidebar navigation
- Search functionality

---

## 🔄 Future Enhancements

Potential features for future releases:
- Video conferencing integration
- Advanced quiz builder
- Plagiarism detection
- Mobile app (React Native)
- Email notifications
- Two-factor authentication
- Advanced analytics dashboard
- Content duplication
- Course templates
- SCORM compliance

---

## 📄 License

ISC License

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📧 Support

For issues, questions, or support, please open an issue on GitHub or contact the development team.

---

## 🙏 Acknowledgments

Built with modern web technologies to provide an exceptional learning management experience.

---

**Version**: 1.0.0  
**Last Updated**: 2024
