const mongoose = require('mongoose');
const Todo = require('../models/todo.model');
const { asyncHandler } = require('../utils/errorHandler');
const { ValidationError, NotFoundError } = require('../utils/errorHandler');

// Create a new to-do
exports.createTodo = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  const { title, dueDate } = req.body;
  
  // Validate title
  if (!title || !title.trim()) {
    throw new ValidationError('Title is required and cannot be empty');
  }
  
  // Validate dueDate if provided
  if (dueDate) {
    const dueDateObj = new Date(dueDate);
    if (isNaN(dueDateObj.getTime())) {
      throw new ValidationError('Invalid due date format');
    }
  }
  
  const todo = new Todo({
    title: title.trim(),
    dueDate: dueDate ? new Date(dueDate) : undefined,
    user: userId,
  });
  await todo.save();
  res.status(201).json(todo);
});

// Get all to-dos for the current user (not completed)
exports.getTodos = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  const todos = await Todo.find({ user: userId, completed: false }).sort({ dueDate: 1 });
  res.json(todos);
});

// Mark a to-do as done (delete or set completed)
exports.deleteTodo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id || req.user.id;
  
  // Validate todo ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid todo ID format');
  }
  
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  const result = await Todo.deleteOne({ _id: id, user: userId });
  
  if (result.deletedCount === 0) {
    throw new NotFoundError('Todo not found or you do not have permission to delete it');
  }
  
  res.json({ success: true });
}); 