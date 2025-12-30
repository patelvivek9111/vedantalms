import api from './api';

export interface Quiz {
  _id: string;
  title: string;
  course: string;
  questions: Array<{
    _id: string;
    questionText: string;
    questionType: 'multiple-choice' | 'true-false';
    options?: string[];
    correctAnswer: number | boolean;
    points: number;
    timeLimit?: number;
  }>;
  createdAt: string;
}

export interface QuizSession {
  _id: string;
  quiz: string | Quiz;
  pin: string;
  status: 'waiting' | 'active' | 'paused' | 'ended';
  currentQuestionIndex: number;
  startedAt?: string;
  endedAt?: string;
  participants: Array<{
    nickname: string;
    score: number;
    userId?: string;
  }>;
}

class QuizWaveService {
  async getQuizzesByCourse(courseId: string): Promise<Quiz[]> {
    const response = await api.get(`/quizwave/quizzes/course/${courseId}`);
    return response.data || [];
  }

  async getQuiz(quizId: string): Promise<Quiz> {
    const response = await api.get(`/quizwave/quizzes/${quizId}`);
    return response.data;
  }

  async createQuiz(quizData: Partial<Quiz>): Promise<Quiz> {
    const response = await api.post('/quizwave/quizzes', quizData);
    return response.data;
  }

  async updateQuiz(quizId: string, quizData: Partial<Quiz>): Promise<Quiz> {
    const response = await api.put(`/quizwave/quizzes/${quizId}`, quizData);
    return response.data;
  }

  async deleteQuiz(quizId: string): Promise<void> {
    await api.delete(`/quizwave/quizzes/${quizId}`);
  }

  async createSession(quizId: string): Promise<QuizSession> {
    const response = await api.post(`/quizwave/quizzes/${quizId}/sessions`);
    return response.data;
  }

  async getSessionByPin(pin: string): Promise<QuizSession> {
    const response = await api.get(`/quizwave/sessions/pin/${pin}`);
    return response.data;
  }

  async getSession(sessionId: string): Promise<QuizSession> {
    const response = await api.get(`/quizwave/sessions/${sessionId}`);
    return response.data;
  }

  async getSessionsByQuiz(quizId: string): Promise<QuizSession[]> {
    const response = await api.get(`/quizwave/quizzes/${quizId}/sessions`);
    return response.data || [];
  }
}

export const quizwaveService = new QuizWaveService();

