import React, { useState, useEffect } from 'react';
import { quizwaveService } from '../../services/quizwaveService';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Users, Clock } from 'lucide-react';
import logger from '../../utils/logger';

interface QuizWaveDashboardProps {
  courseId: string;
}

const QuizWaveDashboard: React.FC<QuizWaveDashboardProps> = ({ courseId }) => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    loadQuizzes();
  }, [courseId]);

  const loadQuizzes = async () => {
    try {
      setLoading(true);
      const data = await quizwaveService.getQuizzesByCourse(courseId);
      setQuizzes(data);
    } catch (error) {
      logger.error('Error loading quizzes', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = () => {
    navigate(`/quizwave/create?courseId=${courseId}`);
  };

  const handleStartSession = async (quizId: string) => {
    try {
      const session = await quizwaveService.createSession(quizId);
      navigate(`/quizwave/session/${session._id}`);
    } catch (error) {
      logger.error('Error starting session', error);
      alert('Failed to start quiz session');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading quizzes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">QuizWave Dashboard</h2>
        <button
          onClick={handleCreateQuiz}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Quiz
        </button>
      </div>

      {quizzes.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No quizzes created yet</p>
          <button
            onClick={handleCreateQuiz}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create Your First Quiz
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((quiz) => (
            <div
              key={quiz._id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {quiz.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {quiz.questions?.length || 0} questions
              </p>
              <button
                onClick={() => handleStartSession(quiz._id)}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                Start Session
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuizWaveDashboard;



