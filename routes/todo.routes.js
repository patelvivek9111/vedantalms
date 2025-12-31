const express = require('express');
const router = express.Router();
const todoController = require('../controllers/todo.controller');
const { protect } = require('../middleware/auth');

router.post('/', protect, todoController.createTodo);
router.get('/', protect, todoController.getTodos);
router.delete('/:id', protect, todoController.deleteTodo);

module.exports = router; 