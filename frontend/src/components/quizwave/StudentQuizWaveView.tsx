import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, LogIn, Users, Clock, Play } from 'lucide-react';
import { quizwaveService } from '../../services/quizwaveService';

interface StudentQuizWaveViewProps {
  courseId: string;
}

const StudentQuizWaveView: React.FC<StudentQuizWaveViewProps> = ({ courseId }) => {
  const navigate = useNavigate();
  const [gamePin, setGamePin] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!gamePin.trim() || gamePin.length !== 6) {
      setError('Please enter a valid 6-digit game PIN');
      setLoading(false);
      return;
    }

    if (!nickname.trim() || nickname.length < 2) {
      setError('Please enter a nickname (at least 2 characters)');
      setLoading(false);
      return;
    }

    try {
      // Verify the session exists and is joinable
      const session = await quizwaveService.getSessionByPin(gamePin.trim());
      
      if (session.status === 'ended') {
        setError('This quiz session has ended');
        setLoading(false);
        return;
      }

      // Navigate to the game screen
      navigate(`/quizwave/play/${gamePin.trim()}`, {
        state: { nickname: nickname.trim() }
      });
    } catch (error: any) {
      setError(error.response?.data?.message || 'Invalid game PIN or session not found');
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
              <Gamepad2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              QuizWave
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Join an interactive quiz session
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <form onSubmit={handleJoin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Game PIN
                </label>
                <input
                  type="text"
                  value={gamePin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setGamePin(value);
                    setError('');
                  }}
                  className="w-full px-4 py-3 text-2xl text-center font-bold tracking-widest border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="000000"
                  maxLength={6}
                  disabled={loading}
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Enter the 6-digit PIN provided by your instructor
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Nickname
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    setError('');
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your nickname"
                  maxLength={50}
                  disabled={loading}
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  This name will appear on the leaderboard
                </p>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Joining...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Join Quiz
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  How to join a quiz:
                </p>
                <div className="space-y-3 text-left max-w-sm mx-auto">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm">
                      1
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get the 6-digit game PIN from your instructor
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm">
                      2
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Enter the PIN and choose a nickname
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm">
                      3
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Wait for the quiz to start and answer questions
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentQuizWaveView;

