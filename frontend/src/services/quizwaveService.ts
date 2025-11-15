import api from './api';

export interface QuizQuestion {
  questionText: string;
  questionType: 'multiple-choice' | 'true-false';
  options: Array<{
    text: string;
    isCorrect: boolean;
  }>;
  timeLimit: number;
  points: number;
  order?: number;
}

export interface QuizSettings {
  showLeaderboard?: boolean;
  showCorrectAnswer?: boolean;
  maxSessionDuration?: number;
}

export interface Quiz {
  _id: string;
  course: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  settings: QuizSettings;
  createdBy: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuizSession {
  _id: string;
  quiz: Quiz | string;
  course: string;
  gamePin: string;
  status: 'waiting' | 'active' | 'paused' | 'ended';
  currentQuestionIndex: number;
  startedAt?: string;
  endedAt?: string;
  participants: Array<{
    student: any;
    nickname: string;
    joinedAt: string;
    totalScore: number;
    answers: Array<{
      questionIndex: number;
      selectedOptions: number[];
      isCorrect: boolean;
      points: number;
      timeTaken: number;
      answeredAt: string;
    }>;
  }>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuizData {
  title: string;
  description?: string;
  questions: QuizQuestion[];
  settings?: QuizSettings;
}

export const quizwaveService = {
  // Quiz CRUD
  createQuiz: async (courseId: string, data: CreateQuizData): Promise<Quiz> => {
    const response = await api.post(`/quizwave/courses/${courseId}`, data);
    return response.data.data;
  },

  getQuizzesByCourse: async (courseId: string): Promise<Quiz[]> => {
    const response = await api.get(`/quizwave/courses/${courseId}`);
    return response.data.data;
  },

  getQuiz: async (quizId: string): Promise<Quiz> => {
    const response = await api.get(`/quizwave/${quizId}`);
    return response.data.data;
  },

  updateQuiz: async (quizId: string, data: Partial<CreateQuizData>): Promise<Quiz> => {
    const response = await api.put(`/quizwave/${quizId}`, data);
    return response.data.data;
  },

  deleteQuiz: async (quizId: string): Promise<void> => {
    await api.delete(`/quizwave/${quizId}`);
  },

  // Session management
  createSession: async (quizId: string): Promise<QuizSession> => {
    const response = await api.post(`/quizwave/${quizId}/sessions`);
    return response.data.data;
  },

  getSessionByPin: async (pin: string): Promise<QuizSession> => {
    const response = await api.get(`/quizwave/sessions/pin/${pin}`);
    return response.data.data;
  },

  getSession: async (sessionId: string): Promise<QuizSession> => {
    const response = await api.get(`/quizwave/sessions/${sessionId}`);
    return response.data.data;
  },

  getSessionsByQuiz: async (quizId: string): Promise<QuizSession[]> => {
    const response = await api.get(`/quizwave/${quizId}/sessions`);
    return response.data.data;
  }
};

