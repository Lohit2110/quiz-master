// Types for the Quiz application

export interface QuizQuestion {
  id: string;
  question: string;
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  correctAnswer: 'a' | 'b' | 'c' | 'd';
  category: string;
  imageUrl?: string;
  explanation?: string;
}

export interface QuizCategory {
  id: string;
  name: string;
  description: string;
  questionCount: number;
}

export interface SavedQuiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  createdAt: number;
  description?: string;
}

export interface QuizSession {
  id: string;
  categoryId: string;
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  answers: { [questionId: string]: string };
  startTime: number;
  endTime?: number;
  isCompleted: boolean;
}

export interface QuizResult {
  sessionId: string;
  categoryName: string;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  skippedQuestions: number;
  score: number;
  percentage: number;
  totalMarks: number; // Total marks obtained (+4 for correct, -1 for wrong)
  maxMarks: number; // Maximum possible marks (totalQuestions * 4)
  timeTaken: number;
  detailedResults: {
    questionId: string;
    question: string;
    options?: {
      a: string;
      b: string;
      c: string;
      d: string;
    };
    imageUrl?: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    marksAwarded: number; // +4, -1, or 0 for skipped
  }[];
}

export interface QuizSettings {
  numberOfQuestions: number;
  selectionMode: 'random' | 'sequential';
  categoryId: string;
}

export interface ImageUploadResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
}
