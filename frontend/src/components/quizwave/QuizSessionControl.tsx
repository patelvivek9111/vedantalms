import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { quizwaveService } from '../../services/quizwaveService';
import { getQuizWaveSocket } from '../../utils/quizwaveSocket';
import logger from '../../utils/logger';
import { Play, Pause, Square, Users } from 'lucide-react';

const QuizSessionControl: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    if (sessionId) {
      loadSession();
      connectSocket();
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const data = await quizwaveService.getSession(sessionId!);
      setSession(data);
    } catch (error) {
      logger.error('Error loading session', error);
    } finally {
      setLoading(false);
    }
  };

  const connectSocket = () => {
    const ws = getQuizWaveSocket();
    ws.on('sessionUpdate', (data: any) => {
      setSession(data);
    });
    setSocket(ws);
  };

  const handleStart = () => {
    if (socket && sessionId) {
      socket.emit('startSession', { sessionId });
    }
  };

  const handlePause = () => {
    if (socket && sessionId) {
      socket.emit('pauseSession', { sessionId });
    }
  };

  const handleEnd = () => {
    if (socket && sessionId) {
      socket.emit('endSession', { sessionId });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6">
        <p className="text-gray-600 dark:text-gray-400">Session not found</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Quiz Session</h2>
            <p className="text-gray-600 dark:text-gray-400">PIN: {session.pin}</p>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-900 dark:text-gray-100">{session.participants?.length || 0} participants</span>
          </div>
        </div>

        <div className="flex gap-4">
          {session.status === 'waiting' && (
            <button
              onClick={handleStart}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Quiz
            </button>
          )}
          {session.status === 'active' && (
            <>
              <button
                onClick={handlePause}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 flex items-center gap-2"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
              <button
                onClick={handleEnd}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                End Quiz
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizSessionControl;



