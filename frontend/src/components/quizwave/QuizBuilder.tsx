import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Save } from 'lucide-react';
import { quizwaveService, Quiz, QuizQuestion, CreateQuizData } from '../../services/quizwaveService';

interface QuizBuilderProps {
  courseId: string;
  quiz?: Quiz | null;
  onClose: () => void;
}

const QuizBuilder: React.FC<QuizBuilderProps> = ({ courseId, quiz, onClose }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [settings, setSettings] = useState({
    showLeaderboard: true,
    showCorrectAnswer: true,
    maxSessionDuration: 120
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (quiz) {
      setTitle(quiz.title);
      setDescription(quiz.description || '');
      setQuestions(quiz.questions);
      setSettings({ ...settings, ...quiz.settings });
    }
  }, [quiz]);

  const addQuestion = (type: 'multiple-choice' | 'true-false') => {
    const newQuestion: QuizQuestion = {
      questionText: '',
      questionType: type,
      options: type === 'true-false'
        ? [
            { text: 'True', isCorrect: false },
            { text: 'False', isCorrect: false }
          ]
        : [
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false }
          ],
      timeLimit: 30,
      order: questions.length
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
  };

  const updateOption = (questionIndex: number, optionIndex: number, text: string) => {
    const updated = [...questions];
    updated[questionIndex].options[optionIndex].text = text;
    setQuestions(updated);
  };

  const setCorrectAnswer = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions];
    const question = updated[questionIndex];
    
    // For multiple-choice, only one correct answer
    if (question.questionType === 'multiple-choice') {
      question.options.forEach((opt, idx) => {
        opt.isCorrect = idx === optionIndex;
      });
    } else {
      // For true/false, toggle
      question.options[optionIndex].isCorrect = !question.options[optionIndex].isCorrect;
      // Ensure only one is correct
      if (question.options[optionIndex].isCorrect) {
        question.options[1 - optionIndex].isCorrect = false;
      }
    }
    
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === questions.length - 1)
    ) {
      return;
    }

    const updated = [...questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setQuestions(updated);
  };

  const handleSave = async () => {
    if (!courseId || courseId.trim() === '') {
      alert('Error: Course ID is missing. Please refresh the page and try again.');
      return;
    }

    if (!title.trim()) {
      alert('Please enter a quiz title');
      return;
    }

    if (questions.length === 0) {
      alert('Please add at least one question');
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        alert(`Question ${i + 1} text is required`);
        return;
      }

      const correctCount = q.options.filter(opt => opt.isCorrect).length;
      if (correctCount !== 1) {
        alert(`Question ${i + 1} must have exactly one correct answer`);
        return;
      }

      if (q.questionType === 'multiple-choice') {
        const emptyOptions = q.options.filter(opt => !opt.text.trim());
        if (emptyOptions.length > 0) {
          alert(`Question ${i + 1} has empty options`);
          return;
        }
      }
    }

    try {
      setSaving(true);
      const data: CreateQuizData = {
        title: title.trim(),
        description: description.trim() || undefined,
        questions: questions.map((q, idx) => ({
          ...q,
          order: idx
        })),
        settings
      };

      if (quiz) {
        await quizwaveService.updateQuiz(quiz._id, data);
      } else {
        await quizwaveService.createQuiz(courseId, data);
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving quiz:', error);
      console.error('Error response:', error.response?.data);
      
      let errorMessage = 'Error saving quiz';
      
      if (error.response?.data) {
        const data = error.response.data;
        if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
          // Handle validation errors array
          errorMessage = data.errors.map((err: any) => err.msg || err.message || err).join('\n');
        } else if (data.message) {
          errorMessage = data.message;
        } else if (data.error) {
          errorMessage = data.error;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
              {quiz ? 'Edit Quiz' : 'Create New Quiz'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex-shrink-0"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          {/* Basic Info */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quiz Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base"
              placeholder="Enter quiz title"
            />
          </div>

          <div className="mb-4 sm:mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base"
              rows={3}
              placeholder="Enter quiz description (optional)"
            />
          </div>

          {/* Settings */}
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Settings</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.showLeaderboard}
                  onChange={(e) => setSettings({ ...settings, showLeaderboard: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show leaderboard</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.showCorrectAnswer}
                  onChange={(e) => setSettings({ ...settings, showCorrectAnswer: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show correct answer after each question</span>
              </label>
            </div>
          </div>

          {/* Questions */}
          <div className="mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-2 mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                Questions ({questions.length})
              </h3>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button
                  onClick={() => addQuestion('multiple-choice')}
                  className="flex-1 sm:flex-none bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                  Multiple Choice
                </button>
                <button
                  onClick={() => addQuestion('true-false')}
                  className="flex-1 sm:flex-none bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                  True/False
                </button>
              </div>
            </div>

            {questions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No questions yet. Add your first question above.
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {questions.map((question, qIndex) => (
                  <div
                    key={qIndex}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 sm:p-4 bg-gray-50 dark:bg-gray-700"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                      <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                        Question {qIndex + 1} ({question.questionType})
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => moveQuestion(qIndex, 'up')}
                          disabled={qIndex === 0}
                          className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveQuestion(qIndex, 'down')}
                          disabled={qIndex === questions.length - 1}
                          className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeQuestion(qIndex)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={question.questionText}
                      onChange={(e) => updateQuestion(qIndex, { questionText: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-3"
                      placeholder="Enter question text"
                    />

                    <div className="mb-3">
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Time Limit (seconds)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="300"
                        value={question.timeLimit}
                        onChange={(e) => updateQuestion(qIndex, { timeLimit: parseInt(e.target.value) || 30 })}
                        className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Options (click to mark correct answer)
                      </label>
                      {question.options.map((option, oIndex) => (
                        <div key={oIndex} className="flex items-center gap-2">
                          <button
                            onClick={() => setCorrectAnswer(qIndex, oIndex)}
                            className={`flex-1 px-3 py-2 rounded-lg border-2 transition-colors ${
                              option.isCorrect
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                            }`}
                          >
                            <input
                              type="text"
                              value={option.text}
                              onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                              className="w-full bg-transparent text-gray-900 dark:text-gray-100 outline-none"
                              placeholder={`Option ${oIndex + 1}`}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </button>
                          {option.isCorrect && (
                            <span className="text-green-600 dark:text-green-400 font-medium text-sm">
                              ✓ Correct
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 sm:px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm sm:text-base"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base"
            >
              <Save className="w-3 h-3 sm:w-4 sm:h-4" />
              {saving ? 'Saving...' : 'Save Quiz'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizBuilder;







