const Todo = require('../models/todo.model');

// Create a new to-do
exports.createTodo = async (req, res) => {
  try {
    const { title, dueDate } = req.body;
    
    // Validate and trim title
    if (!title || !title.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Title is required and cannot be empty' 
      });
    }
    
    const todo = new Todo({
      title: title.trim(),
      dueDate,
      user: req.user._id,
    });
    await todo.save();
    res.status(201).json(todo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all to-dos for the current user (not completed)
exports.getTodos = async (req, res) => {
  try {
    const todos = await Todo.find({ user: req.user._id, completed: false }).sort({ dueDate: 1 });
    res.json(todos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mark a to-do as done (delete or set completed)
exports.deleteTodo = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const todoId = req.params.id;
    
    // Validate ObjectId
    if (!todoId || !mongoose.Types.ObjectId.isValid(todoId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid todo ID' 
      });
    }
    
    const todo = await Todo.findOne({ _id: todoId, user: req.user._id });
    if (!todo) {
      return res.status(404).json({ 
        success: false,
        error: 'Todo not found' 
      });
    }
    
    await Todo.deleteOne({ _id: todoId, user: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 