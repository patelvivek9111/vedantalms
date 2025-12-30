import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { quizwaveService } from '../../services/quizwaveService';
import logger from '../../utils/logger';

const QuizBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('courseId') || '';

  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<Array<{
    questionText: string;
    questionType: 'multiple-choice' | 'true-false';
    options?: string[];
    correctAnswer: number | boolean;
    points: number;
  }>>([]);
  const [loading, setLoading] = useState(false);

  const handleAddQuestion = () => {
    setQuestions([...questions, {
      questionText: '',
      questionType: 'multiple-choice',
      options: ['', '', '', ''],
      correctAnswer: 0,
      points: 1
    }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a quiz title');
      return;
    }
    if (questions.length === 0) {
      alert('Please add at least one question');
      return;
    }

    setLoading(true);
    try {
      await quizwaveService.createQuiz({
        title,
        course: courseId,
        questions
      });
      navigate(`/courses/${courseId}?tab=quizwave`);
    } catch (error) {
      logger.error('Error creating quiz', error);
      alert('Failed to create quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Create Quiz</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quiz Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Questions</h3>
            <button
              type="button"
              onClick={handleAddQuestion}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add Question
            </button>
          </div>
          {questions.length === 0 && (
            <p className="text-gray-600 dark:text-gray-400">No questions added yet. Click "Add Question" to get started.</p>
          )}
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Quiz'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuizBuilder;



