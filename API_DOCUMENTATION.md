# 📡 API Documentation

Complete API reference for Vedanta LMS backend.

## Base URL

- **Development**: `http://localhost:5000/api`
- **Production**: `https://vedantaed.com/api`

## Authentication

Most endpoints require authentication via JWT token. Include the token in the Authorization header:

```
Authorization: Bearer <token>
```

---

## 🔐 Authentication Endpoints

### Register User
```http
POST /api/auth/register
```

**Rate Limit**: 3 registrations per hour per IP

**Request Body**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "student"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "user": { ... }
  }
}
```

### Login
```http
POST /api/auth/login
```

**Rate Limit**: 5 attempts per 15 minutes per IP

**Request Body**:
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "user": { ... }
  }
}
```

### Get Current User
```http
GET /api/auth/me
```

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "role": "student"
  }
}
```

### Get Login Activity
```http
GET /api/auth/login-activity
```

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "ipAddress": "127.0.0.1",
      "userAgent": "...",
      "timestamp": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## 📚 Course Endpoints

### Get All Courses
```http
GET /api/courses
```

**Query Parameters**:
- `instructor` - Filter by instructor ID
- `student` - Filter by enrolled student ID
- `search` - Search by title or code

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "title": "Introduction to Computer Science",
      "code": "CS101",
      "instructor": { ... },
      "enrolledStudents": [ ... ]
    }
  ]
}
```

### Create Course
```http
POST /api/courses
```

**Headers**: `Authorization: Bearer <token>` (Teacher/Admin only)

**Request Body**:
```json
{
  "title": "Introduction to Computer Science",
  "code": "CS101",
  "description": "Course description",
  "semester": "Fall 2025",
  "creditHours": 3
}
```

### Get Course Details
```http
GET /api/courses/:id
```

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "title": "...",
    "modules": [ ... ],
    "enrolledStudents": [ ... ]
  }
}
```

### Update Course
```http
PUT /api/courses/:id
```

**Headers**: `Authorization: Bearer <token>` (Instructor/Admin only)

### Delete Course
```http
DELETE /api/courses/:id
```

**Headers**: `Authorization: Bearer <token>` (Instructor/Admin only)

### Enroll Student
```http
POST /api/courses/:id/enrollment
```

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "studentId": "student_id_here"
}
```

### Unenroll Student
```http
POST /api/courses/:id/unenroll
```

**Headers**: `Authorization: Bearer <token>` (Instructor/Admin only)

---

## 📝 Assignment Endpoints

### Get Assignments
```http
GET /api/assignments
```

**Query Parameters**:
- `course` - Filter by course ID
- `student` - Filter by student ID
- `module` - Filter by module ID

### Create Assignment
```http
POST /api/assignments
```

**Headers**: `Authorization: Bearer <token>` (Teacher/Admin only)

**Request Body**:
```json
{
  "title": "Assignment 1",
  "description": "Assignment description",
  "courseId": "course_id",
  "moduleId": "module_id",
  "dueDate": "2025-12-31T23:59:59.000Z",
  "questions": [
    {
      "type": "text",
      "question": "What is...?",
      "points": 10
    }
  ],
  "totalPoints": 100
}
```

### Get Assignment Details
```http
GET /api/assignments/:id
```

### Update Assignment
```http
PUT /api/assignments/:id
```

**Headers**: `Authorization: Bearer <token>` (Teacher/Admin only)

### Delete Assignment
```http
DELETE /api/assignments/:id
```

**Headers**: `Authorization: Bearer <token>` (Teacher/Admin only)

### Publish Assignment
```http
POST /api/assignments/:id/publish
```

**Headers**: `Authorization: Bearer <token>` (Teacher/Admin only)

---

## 📤 Submission Endpoints

### Submit Assignment
```http
POST /api/submissions
```

**Headers**: `Authorization: Bearer <token>`

**Request Body** (multipart/form-data):
- `assignmentId` - Assignment ID
- `answers` - JSON string of answers
- `files` - File attachments (optional)

### Get Submissions for Assignment
```http
GET /api/submissions/assignment/:id
```

**Headers**: `Authorization: Bearer <token>` (Teacher/Admin only)

### Get Student Submissions
```http
GET /api/submissions/student/:id
```

**Headers**: `Authorization: Bearer <token>`

### Grade Submission
```http
PUT /api/submissions/:id/grade
```

**Headers**: `Authorization: Bearer <token>` (Teacher/Admin only)

**Request Body**:
```json
{
  "grade": 85,
  "feedback": "Good work!",
  "questionGrades": {
    "questionId": 10
  }
}
```

---

## 📊 Grade Endpoints

### Get Course Grades
```http
GET /api/grades/course/:id
```

**Headers**: `Authorization: Bearer <token>`

### Get Student Grades
```http
GET /api/grades/student/:id
```

**Headers**: `Authorization: Bearer <token>`

### Create Grade Entry
```http
POST /api/grades
```

**Headers**: `Authorization: Bearer <token>` (Teacher/Admin only)

### Update Grade
```http
PUT /api/grades/:id
```

**Headers**: `Authorization: Bearer <token>` (Teacher/Admin only)

---

## 💬 Discussion Endpoints

### Get Threads
```http
GET /api/threads
```

**Query Parameters**:
- `course` - Filter by course ID
- `module` - Filter by module ID
- `group` - Filter by group ID

### Create Thread
```http
POST /api/threads
```

**Headers**: `Authorization: Bearer <token>` (Teacher/Admin only)

**Request Body**:
```json
{
  "title": "Discussion Topic",
  "content": "Discussion content",
  "courseId": "course_id",
  "moduleId": "module_id",
  "isGraded": false,
  "totalPoints": 0
}
```

### Get Thread Details
```http
GET /api/threads/:id
```

### Reply to Thread
```http
POST /api/threads/:id/replies
```

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "content": "Reply content"
}
```

---

## 👥 Group Endpoints

### Get Groups
```http
GET /api/groups
```

**Query Parameters**:
- `course` - Filter by course ID
- `groupSet` - Filter by group set ID

### Create Group
```http
POST /api/groups
```

**Headers**: `Authorization: Bearer <token>` (Teacher/Admin only)

### Get Group Details
```http
GET /api/groups/:id
```

### Add Group Member
```http
POST /api/groups/:id/members
```

**Headers**: `Authorization: Bearer <token>` (Teacher/Admin only)

---

## 📢 Announcement Endpoints

### Get Announcements
```http
GET /api/announcements/course/:courseId
```

**Query Parameters**:
- `pinned` - Filter pinned announcements

### Create Announcement
```http
POST /api/announcements
```

**Headers**: `Authorization: Bearer <token>` (Teacher/Admin only)

### Get Announcement Comments
```http
GET /api/announcements/:id/comments
```

### Add Comment
```http
POST /api/announcements/:id/comments
```

**Headers**: `Authorization: Bearer <token>`

---

## 📅 Event Endpoints

### Get Events
```http
GET /api/events
```

**Query Parameters**:
- `course` - Filter by course ID
- `start` - Start date (ISO string)
- `end` - End date (ISO string)

### Create Event
```http
POST /api/events
```

**Headers**: `Authorization: Bearer <token>`

---

## ✅ Todo Endpoints

### Get Todos
```http
GET /api/todos
```

**Headers**: `Authorization: Bearer <token>`

### Create Todo
```http
POST /api/todos
```

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "title": "Complete assignment",
  "dueDate": "2025-12-31T23:59:59.000Z",
  "courseId": "course_id"
}
```

### Delete Todo
```http
DELETE /api/todos/:id
```

**Headers**: `Authorization: Bearer <token>`

---

## 📬 Inbox Endpoints

### Get Conversations
```http
GET /api/inbox/conversations
```

**Headers**: `Authorization: Bearer <token>`

### Create Conversation
```http
POST /api/inbox/conversations
```

**Headers**: `Authorization: Bearer <token>`

### Get Messages
```http
GET /api/inbox/conversations/:id/messages
```

**Headers**: `Authorization: Bearer <token>`

### Send Message
```http
POST /api/inbox/conversations/:id/messages
```

**Headers**: `Authorization: Bearer <token>`

---

## 🔔 Notification Endpoints

### Get Notifications
```http
GET /api/notifications
```

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `read` - Filter by read status (true/false)
- `type` - Filter by notification type
- `page` - Page number
- `limit` - Items per page

### Mark as Read
```http
PUT /api/notifications/:id/read
```

**Headers**: `Authorization: Bearer <token>`

---

## 👨‍💼 Admin Endpoints

### Get All Users
```http
GET /api/admin/users
```

**Headers**: `Authorization: Bearer <token>` (Admin only)

### Get System Analytics
```http
GET /api/admin/analytics
```

**Headers**: `Authorization: Bearer <token>` (Admin only)

---

## 📊 Report Endpoints

### Get Available Semesters
```http
GET /api/reports/semesters
```

**Headers**: `Authorization: Bearer <token>`

### Get Student Transcript
```http
GET /api/reports/transcript/:studentId
```

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `semester` - Filter by semester

---

## ⚠️ Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}
```

**Status Codes**:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests (Rate Limited)
- `500` - Internal Server Error

---

## 🔒 Rate Limiting

- **General API**: 100 requests per 15 minutes
- **Login**: 5 attempts per 15 minutes
- **Registration**: 3 registrations per hour

Rate limit headers are included in responses:
- `X-RateLimit-Limit` - Request limit
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset time (Unix timestamp)

---

## 📝 Notes

- All dates should be in ISO 8601 format
- File uploads use `multipart/form-data`
- Pagination uses `page` and `limit` query parameters
- Most list endpoints support filtering via query parameters






















