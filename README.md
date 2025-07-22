# Learning Management System (LMS)

## Recent Updates

### 1. Student Search Improvements
- The student search in the course detail page now supports partial, case-insensitive matches for both name and email.
- The backend `/api/users/search` endpoint was updated to use a `$or` query, so students are found if either their first name, last name, or email matches the search string.
- The frontend search UI now displays a loading indicator, error messages, and a 'no students found' message when appropriate.

### 2. Unenroll Student Feature
- A new backend endpoint was added: `POST /api/courses/:courseId/unenroll`.
- This endpoint removes a student from a course's `students` array. It requires `{ studentId }` in the request body.
- The route is protected and only accessible to teachers and admins.
- The controller logs incoming requests for easier debugging.

### 3. Frontend Unenroll Improvements
- After unenrolling a student, the frontend now refreshes the course data so the UI updates immediately without a manual page refresh.
- The enrolled students list updates in real time after unenrollment.

### 4. General Fixes
- Added proper error handling and feedback for search and enrollment actions.
- Ensured all backend routes use authentication and authorization middleware for security.

## How to Use

1. **Start the backend server:**
   - `npm start` or `npx nodemon` in the backend directory.
2. **Start the frontend server:**
   - `npm start` in the frontend directory.
3. **Student Search:**
   - Go to a course detail page as a teacher or admin.
   - Use the search box in the Student Management section to find students by name or email.
4. **Enroll/Unenroll Students:**
   - Click 'Enroll' to add a student to the course.
   - Click 'Remove' to unenroll a student. The list updates immediately.

## Troubleshooting
- If you make backend changes, always restart the backend server.
- If you see a 404 or 401 error, check that you are authenticated and have the correct role.
- If search returns no results, ensure there are students in your database and the backend search logic is up to date.

---

For more details, see the code comments in `controllers/user.controller.js`, `controllers/course.controller.js`, and `frontend/src/components/CourseDetail.tsx`. 