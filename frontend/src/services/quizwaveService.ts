import api from './api';

// Helper to validate ObjectId-like strings (24 hex characters)
const isValidId = (id: string): boolean => {
  return id && typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id.trim());
};

// Helper to validate game PIN (6-digit numeric string)
const isValidPin = (pin: string): boolean => {
  return pin && typeof pin === 'string' && /^\d{6}$/.test(pin.trim());
};

export interface QuizQuestion {
  questionText: string;
  questionType: 'multiple-choice' | 'true-false';
  options: Array<{
    text: string;
    isCorrect: boolean;
  }>;
  timeLimit: number;
  points?: number; // Optional, kept for backward compatibility but not used in scoring
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
    // Validate courseId
    if (!isValidId(courseId)) {
      throw new Error('Invalid course ID format');
    }

    // Validate data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid quiz data');
    }

    // Validate title
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new Error('Quiz title is required');
    }

    // Validate questions
    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error('At least one question is required');
    }

    const response = await api.post(`/quizwave/courses/${courseId}`, data);
    return response.data.data;
  },

  getQuizzesByCourse: async (courseId: string): Promise<Quiz[]> => {
    // Validate courseId
    if (!isValidId(courseId)) {
      throw new Error('Invalid course ID format');
    }

    const response = await api.get(`/quizwave/courses/${courseId}`);
    return response.data.data;
  },

  getQuiz: async (quizId: string): Promise<Quiz> => {
    // Validate quizId
    if (!isValidId(quizId)) {
      throw new Error('Invalid quiz ID format');
    }

    const response = await api.get(`/quizwave/${quizId}`);
    return response.data.data;
  },

  updateQuiz: async (quizId: string, data: Partial<CreateQuizData>): Promise<Quiz> => {
    // Validate quizId
    if (!isValidId(quizId)) {
      throw new Error('Invalid quiz ID format');
    }

    // Validate data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid quiz data');
    }

    // Validate title if provided
    if (data.title !== undefined && (typeof data.title !== 'string' || data.title.trim().length === 0)) {
      throw new Error('Quiz title cannot be empty');
    }

    const response = await api.put(`/quizwave/${quizId}`, data);
    return response.data.data;
  },

  deleteQuiz: async (quizId: string): Promise<void> => {
    // Validate quizId
    if (!isValidId(quizId)) {
      throw new Error('Invalid quiz ID format');
    }

    await api.delete(`/quizwave/${quizId}`);
  },

  // Session management
  createSession: async (quizId: string): Promise<QuizSession> => {
    // Validate quizId
    if (!isValidId(quizId)) {
      throw new Error('Invalid quiz ID format');
    }

    const response = await api.post(`/quizwave/${quizId}/sessions`);
    return response.data.data;
  },

  getSessionByPin: async (pin: string): Promise<QuizSession> => {
    // Validate PIN format
    if (!isValidPin(pin)) {
      throw new Error('Invalid game PIN format. Must be 6 digits.');
    }

    const response = await api.get(`/quizwave/sessions/pin/${pin}`);
    return response.data.data;
  },

  getSession: async (sessionId: string): Promise<QuizSession> => {
    // Validate sessionId
    if (!isValidId(sessionId)) {
      throw new Error('Invalid session ID format');
    }

    const response = await api.get(`/quizwave/sessions/${sessionId}`);
    return response.data.data;
  },

  getSessionsByQuiz: async (quizId: string): Promise<QuizSession[]> => {
    // Validate quizId
    if (!isValidId(quizId)) {
      throw new Error('Invalid quiz ID format');
    }

    const response = await api.get(`/quizwave/${quizId}/sessions`);
    return response.data.data;
  }
};

