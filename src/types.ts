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
  imageUrls?: string[];
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
  defaultTimerMinutes?: number; // Default time limit for the quiz
  published?: boolean; // Whether quiz is published to students (false = draft mode)
  publishedAt?: number; // When quiz was published to students
  publishedBy?: string; // Who published the quiz
  lastModified?: number; // Last modification timestamp
  subject?: string; // Subject name (e.g., "Physics", "Mathematics")
  chapters?: string[]; // List of chapters covered in this quiz
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
  quizTitle: string; // Name of the quiz taken
  studentName: string; // Student who took the quiz
  studentEmail?: string; // Optional email
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  skippedQuestions: number;
  score: number;
  percentage: number;
  totalMarks: number; // Total marks obtained (+4 for correct, -1 for wrong)
  maxMarks: number; // Maximum possible marks (totalQuestions * 4)
  timeTaken: number;
  completedAt: number; // Timestamp when quiz was completed
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

export interface StudentInfo {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  class?: string;
  loginTime?: number;
  sessionId?: string;
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
