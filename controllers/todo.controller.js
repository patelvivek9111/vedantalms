const mongoose = require('mongoose');
const Todo = require('../models/todo.model');

// Create a new to-do
exports.createTodo = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const { title, dueDate } = req.body;
    
    // Validate title
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Title is required and cannot be empty'
      });
    }
    
    // Validate dueDate if provided
    if (dueDate) {
      const dueDateObj = new Date(dueDate);
      if (isNaN(dueDateObj.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid due date format'
        });
      }
    }
    
    const todo = new Todo({
      title: title.trim(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      user: userId,
    });
    await todo.save();
    res.status(201).json(todo);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// Get all to-dos for the current user (not completed)
exports.getTodos = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const todos = await Todo.find({ user: userId, completed: false }).sort({ dueDate: 1 });
    res.json(todos);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Mark a to-do as done (delete or set completed)
exports.deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;
    
    // Validate todo ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid todo ID format'
      });
    }
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const result = await Todo.deleteOne({ _id: id, user: userId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Todo not found or you do not have permission to delete it'
      });
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}; 