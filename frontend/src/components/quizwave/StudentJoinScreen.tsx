import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Gamepad2 } from 'lucide-react';

const StudentJoinScreen: React.FC = () => {
  const navigate = useNavigate();
  const [gamePin, setGamePin] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!gamePin.trim() || gamePin.length !== 6) {
      setError('Please enter a valid 6-digit game PIN');
      return;
    }

    if (!nickname.trim() || nickname.length < 2) {
      setError('Please enter a nickname (at least 2 characters)');
      return;
    }

    navigate(`/quizwave/play/${gamePin}`, {
      state: { nickname: nickname.trim() }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
            <Gamepad2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            QuizWave
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Enter the game PIN to join
          </p>
        </div>

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
              className="w-full px-4 py-3 text-3xl text-center font-bold tracking-widest border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="000000"
              maxLength={6}
            />
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
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5" />
            Join Game
          </button>
        </form>
      </div>
    </div>
  );
};

export default StudentJoinScreen;

