const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const Todo = require('../models/todo.model');
const { waitForMongoConnection } = require('./helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Todo API', () => {
  let studentToken;
  let studentId;
  let teacherToken;
  let teacherId;
  let todoId;

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    
    // Clean up test data
    await User.deleteMany({ email: { $in: ['student-todo@test.com', 'teacher-todo@test.com'] } });
    await Todo.deleteMany({});

    // Create student
    const studentResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Student',
        lastName: 'Todo',
        email: 'student-todo@test.com',
        password: 'password123',
        role: 'student'
      });
    studentToken = studentResponse.body.token;
    studentId = studentResponse.body.user.id;

    // Create teacher
    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Todo',
        email: 'teacher-todo@test.com',
        password: 'password123',
        role: 'teacher'
      });
    teacherToken = teacherResponse.body.token;
    teacherId = teacherResponse.body.user.id;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['student-todo@test.com', 'teacher-todo@test.com'] } });
    await Todo.deleteMany({});
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('POST /api/todos', () => {
    it('should create todo', async () => {
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Test Todo',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Test Todo');
      expect(response.body.user).toBeDefined();
      todoId = response.body._id || response.body.id;
    });

    it('should create todo with due date', async () => {
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Todo With Due Date',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Todo With Due Date');
      expect(response.body.dueDate).toBeDefined();
    });

    it('should require title', async () => {
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          dueDate: new Date().toISOString()
        });

      expect(response.status).toBe(400);
    });

    it('should reject empty title', async () => {
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: '   ',
          dueDate: new Date().toISOString()
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid due date format', async () => {
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Test Todo',
          dueDate: 'invalid-date'
        });

      expect(response.status).toBe(400);
    });

    it('should trim title whitespace', async () => {
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: '  Trimmed Todo  ',
          dueDate: new Date().toISOString()
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Trimmed Todo');
    });
  });

  describe('GET /api/todos', () => {
    it('should get todos for user', async () => {
      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should only return incomplete todos', async () => {
      // Create a completed todo
      const completedTodo = new Todo({
        title: 'Completed Todo',
        dueDate: new Date(),
        user: studentId,
        completed: true
      });
      await completedTodo.save();

      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.every(todo => todo.completed === false)).toBe(true);

      // Cleanup
      await Todo.findByIdAndDelete(completedTodo._id);
    });

    it('should sort todos by due date', async () => {
      // Create multiple todos with different due dates
      const todo1 = new Todo({
        title: 'Todo 1',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        user: studentId,
        completed: false
      });
      const todo2 = new Todo({
        title: 'Todo 2',
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
        user: studentId,
        completed: false
      });
      await todo1.save();
      await todo2.save();

      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      // Should be sorted by dueDate ascending
      const todos = response.body.filter(t => t.title === 'Todo 1' || t.title === 'Todo 2');
      if (todos.length >= 2) {
        const todo2Index = todos.findIndex(t => t.title === 'Todo 2');
        const todo1Index = todos.findIndex(t => t.title === 'Todo 1');
        expect(todo2Index).toBeLessThan(todo1Index);
      }

      // Cleanup
      await Todo.findByIdAndDelete(todo1._id);
      await Todo.findByIdAndDelete(todo2._id);
    });

    it('should only return todos for the authenticated user', async () => {
      // Create todo for teacher
      const teacherTodo = new Todo({
        title: 'Teacher Todo',
        dueDate: new Date(),
        user: teacherId,
        completed: false
      });
      await teacherTodo.save();

      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.every(todo => todo.user.toString() === studentId.toString())).toBe(true);

      // Cleanup
      await Todo.findByIdAndDelete(teacherTodo._id);
    });

    it('should return empty array when no todos', async () => {
      // Create new user with no todos
      const newUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'New',
          lastName: 'User',
          email: 'new-user-todo@test.com',
          password: 'password123',
          role: 'student'
        });
      const newToken = newUserResponse.body.token;

      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${newToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);

      // Cleanup
      await User.deleteMany({ email: 'new-user-todo@test.com' });
    });
  });

  describe('DELETE /api/todos/:id', () => {
    it('should delete todo', async () => {
      // Create todo to delete
      const deleteTodo = new Todo({
        title: 'Todo to Delete',
        dueDate: new Date(),
        user: studentId,
        completed: false
      });
      await deleteTodo.save();

      const response = await request(app)
        .delete(`/api/todos/${deleteTodo._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid todo ID', async () => {
      const response = await request(app)
        .delete('/api/todos/invalid-id')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    it('should prevent deleting other user todo', async () => {
      // Create todo for teacher
      const teacherTodo = new Todo({
        title: 'Teacher Todo to Delete',
        dueDate: new Date(),
        user: teacherId,
        completed: false
      });
      await teacherTodo.save();

      // Student tries to delete teacher's todo
      const response = await request(app)
        .delete(`/api/todos/${teacherTodo._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);

      // Cleanup
      await Todo.findByIdAndDelete(teacherTodo._id);
    });

    it('should return 404 for non-existent todo', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/todos/${fakeId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });

    it('should allow teacher to delete own todos', async () => {
      // Create todo for teacher
      const teacherTodo = new Todo({
        title: 'Teacher Own Todo',
        dueDate: new Date(),
        user: teacherId,
        completed: false
      });
      await teacherTodo.save();

      const response = await request(app)
        .delete(`/api/todos/${teacherTodo._id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
    });
  });
});

