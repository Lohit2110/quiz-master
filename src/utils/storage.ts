import { QuizQuestion, QuizCategory, QuizSession, QuizResult, SavedQuiz } from '../types';

// Local storage keys
const STORAGE_KEYS = {
  QUESTIONS: 'quiz_master_questions',
  CATEGORIES: 'quiz_master_categories',
  SESSIONS: 'quiz_master_sessions',
  CURRENT_SESSION: 'quiz_master_current_session',
  SETTINGS: 'quiz_master_settings',
  SAVED_QUIZZES: 'quiz_master_saved_quizzes'
};

// Storage limits and cleanup settings
const STORAGE_LIMITS = {
  MAX_SESSIONS: 10, // Keep only the last 10 sessions
  MAX_STORAGE_SIZE: 4 * 1024 * 1024, // 4MB limit
  SESSION_EXPIRY_DAYS: 7 // Delete sessions older than 7 days
};

// Storage utility functions
const StorageHelper = {
  // Safe storage with error handling
  safeSetItem: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('Storage error:', error);
      
      // If quota exceeded, try to clean up and retry
      if (error instanceof DOMException && error.code === 22) {
        StorageHelper.cleanupStorage();
        try {
          localStorage.setItem(key, value);
          return true;
        } catch (retryError) {
          console.error('Storage still full after cleanup:', retryError);
          return false;
        }
      }
      return false;
    }
  },

  // Calculate total storage usage
  getStorageSize: (): number => {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
    return total;
  },

  // Clean up old and unnecessary data
  cleanupStorage: (): void => {
    console.log('Starting storage cleanup...');
    
    // Only clean up session data - NEVER touch saved quizzes, questions, or categories
    StorageHelper.cleanupOldSessions();
    StorageHelper.limitSessions();
    
    // Remove any orphaned current session data
    const currentSession = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
    if (currentSession) {
      try {
        const session = JSON.parse(currentSession);
        // If session is older than 24 hours, remove it
        if (Date.now() - session.startTime > 24 * 60 * 60 * 1000) {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
          console.log('Removed old current session');
        }
      } catch (error) {
        // If current session data is corrupted, remove it
        localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
        console.log('Removed corrupted current session');
      }
    }
    
    console.log('Storage cleanup completed - Saved quizzes preserved');
  },

  // Remove sessions older than expiry date
  cleanupOldSessions: (): void => {
    const sessions = StorageUtils.getSessions();
    const expiryTime = Date.now() - (STORAGE_LIMITS.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    
    const validSessions = sessions.filter(session => {
      return session.startTime > expiryTime;
    });

    if (validSessions.length !== sessions.length) {
      console.log(`Removed ${sessions.length - validSessions.length} expired sessions`);
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(validSessions));
    }
  },

  // Limit number of stored sessions
  limitSessions: (): void => {
    const sessions = StorageUtils.getSessions();
    
    if (sessions.length > STORAGE_LIMITS.MAX_SESSIONS) {
      // Sort by start time (newest first) and keep only the latest sessions
      sessions.sort((a, b) => b.startTime - a.startTime);
      const limitedSessions = sessions.slice(0, STORAGE_LIMITS.MAX_SESSIONS);
      
      console.log(`Limited sessions from ${sessions.length} to ${limitedSessions.length}`);
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(limitedSessions));
    }
  }
};

// Sample data for initial setup
const SAMPLE_CATEGORIES: QuizCategory[] = [
  {
    id: 'general-knowledge',
    name: 'General Knowledge',
    description: 'Test your general knowledge with these questions',
    questionCount: 0
  },
  {
    id: 'science',
    name: 'Science',
    description: 'Science and technology questions',
    questionCount: 0
  },
  {
    id: 'history',
    name: 'History',
    description: 'Historical events and figures',
    questionCount: 0
  },
  {
    id: 'sports',
    name: 'Sports',
    description: 'Sports and games trivia',
    questionCount: 0
  }
];

const SAMPLE_QUESTIONS: QuizQuestion[] = [
  {
    id: '1',
    question: 'What is the capital of France?',
    options: {
      a: 'London',
      b: 'Berlin',
      c: 'Paris',
      d: 'Madrid'
    },
    correctAnswer: 'c',
    category: 'general-knowledge'
  },
  {
    id: '2',
    question: 'Which planet is known as the Red Planet?',
    options: {
      a: 'Venus',
      b: 'Mars',
      c: 'Jupiter',
      d: 'Saturn'
    },
    correctAnswer: 'b',
    category: 'science'
  },
  {
    id: '3',
    question: 'Who painted the Mona Lisa?',
    options: {
      a: 'Vincent van Gogh',
      b: 'Pablo Picasso',
      c: 'Leonardo da Vinci',
      d: 'Michelangelo'
    },
    correctAnswer: 'c',
    category: 'general-knowledge'
  },
  {
    id: '4',
    question: 'In which year did World War II end?',
    options: {
      a: '1944',
      b: '1945',
      c: '1946',
      d: '1947'
    },
    correctAnswer: 'b',
    category: 'history'
  },
  {
    id: '5',
    question: 'How many players are there in a basketball team on the court?',
    options: {
      a: '4',
      b: '5',
      c: '6',
      d: '7'
    },
    correctAnswer: 'b',
    category: 'sports'
  }
];

// Storage utilities
export const StorageUtils = {
  // Initialize data if not exists
  initializeStorage: (): void => {
    // Cleanup storage on initialization (only sessions, not user data)
    StorageHelper.cleanupStorage();
    
    // Only initialize if completely empty - preserve any existing user data
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
      StorageUtils.saveCategories(SAMPLE_CATEGORIES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.QUESTIONS)) {
      StorageUtils.saveQuestions(SAMPLE_QUESTIONS);
      StorageUtils.updateCategoryQuestionCounts();
    }
    
    // Initialize saved quizzes array if it doesn't exist (but don't overwrite)
    if (!localStorage.getItem(STORAGE_KEYS.SAVED_QUIZZES)) {
      StorageUtils.saveSavedQuizzes([]);
    }
  },

  // Recovery function to restore without losing user data
  safeInitialize: (): void => {
    console.log('Safe initialization - preserving user data');
    
    // Only add missing default categories/questions, don't overwrite
    const existingCategories = StorageUtils.getCategories();
    const existingQuestions = StorageUtils.getQuestions();
    
    // Add missing default categories
    const categoriesToAdd = SAMPLE_CATEGORIES.filter(sampleCat => 
      !existingCategories.some(existingCat => existingCat.id === sampleCat.id)
    );
    if (categoriesToAdd.length > 0) {
      StorageUtils.saveCategories([...existingCategories, ...categoriesToAdd]);
    }
    
    // Add missing default questions
    const questionsToAdd = SAMPLE_QUESTIONS.filter(sampleQ => 
      !existingQuestions.some(existingQ => existingQ.id === sampleQ.id)
    );
    if (questionsToAdd.length > 0) {
      StorageUtils.saveQuestions([...existingQuestions, ...questionsToAdd]);
    }
    
    // Ensure saved quizzes array exists
    if (!localStorage.getItem(STORAGE_KEYS.SAVED_QUIZZES)) {
      StorageUtils.saveSavedQuizzes([]);
    }
    
    StorageUtils.updateCategoryQuestionCounts();
    console.log('Safe initialization completed');
  },

  // Questions
  getQuestions: (): QuizQuestion[] => {
    const questions = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    return questions ? JSON.parse(questions) : [];
  },

  saveQuestions: (questions: QuizQuestion[]): void => {
    StorageHelper.safeSetItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    StorageUtils.updateCategoryQuestionCounts();
  },

  addQuestion: (question: QuizQuestion): void => {
    const questions = StorageUtils.getQuestions();
    questions.push(question);
    StorageUtils.saveQuestions(questions);
  },

  updateQuestion: (updatedQuestion: QuizQuestion): void => {
    const questions = StorageUtils.getQuestions();
    const index = questions.findIndex(q => q.id === updatedQuestion.id);
    if (index !== -1) {
      questions[index] = updatedQuestion;
      StorageUtils.saveQuestions(questions);
    }
  },

  deleteQuestion: (questionId: string): void => {
    const questions = StorageUtils.getQuestions();
    const filteredQuestions = questions.filter(q => q.id !== questionId);
    StorageUtils.saveQuestions(filteredQuestions);
  },

  getQuestionsByCategory: (categoryId: string): QuizQuestion[] => {
    const questions = StorageUtils.getQuestions();
    return questions.filter(q => q.category === categoryId);
  },

  // Categories
  getCategories: (): QuizCategory[] => {
    const categories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    return categories ? JSON.parse(categories) : [];
  },

  saveCategories: (categories: QuizCategory[]): void => {
    StorageHelper.safeSetItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  },

  addCategory: (category: QuizCategory): void => {
    const categories = StorageUtils.getCategories();
    categories.push(category);
    StorageUtils.saveCategories(categories);
  },

  updateCategory: (updatedCategory: QuizCategory): void => {
    const categories = StorageUtils.getCategories();
    const index = categories.findIndex(c => c.id === updatedCategory.id);
    if (index !== -1) {
      categories[index] = updatedCategory;
      StorageUtils.saveCategories(categories);
    }
  },

  deleteCategory: (categoryId: string): void => {
    const categories = StorageUtils.getCategories();
    const filteredCategories = categories.filter(c => c.id !== categoryId);
    StorageUtils.saveCategories(filteredCategories);
    
    // Also delete all questions in this category
    const questions = StorageUtils.getQuestions();
    const filteredQuestions = questions.filter(q => q.category !== categoryId);
    StorageUtils.saveQuestions(filteredQuestions);
  },

  updateCategoryQuestionCounts: (): void => {
    const categories = StorageUtils.getCategories();
    const questions = StorageUtils.getQuestions();
    
    const updatedCategories = categories.map(category => ({
      ...category,
      questionCount: questions.filter(q => q.category === category.id).length
    }));
    
    StorageUtils.saveCategories(updatedCategories);
  },

  // Sessions
  getCurrentSession: (): QuizSession | null => {
    const session = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
    return session ? JSON.parse(session) : null;
  },

  saveCurrentSession: (session: QuizSession): void => {
    StorageHelper.safeSetItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(session));
  },

  clearCurrentSession: (): void => {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
  },

  getSessions: (): QuizSession[] => {
    const sessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    return sessions ? JSON.parse(sessions) : [];
  },

  saveSession: (session: QuizSession): void => {
    const sessions = StorageUtils.getSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    
    if (existingIndex !== -1) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    
    // Use safe storage with cleanup
    const success = StorageHelper.safeSetItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    if (!success) {
      console.error('Failed to save session even after cleanup');
      // Optionally show user notification
    }
  },

  // Saved Quizzes
  getSavedQuizzes: (): SavedQuiz[] => {
    const quizzes = localStorage.getItem(STORAGE_KEYS.SAVED_QUIZZES);
    return quizzes ? JSON.parse(quizzes) : [];
  },

  saveSavedQuizzes: (quizzes: SavedQuiz[]): void => {
    StorageHelper.safeSetItem(STORAGE_KEYS.SAVED_QUIZZES, JSON.stringify(quizzes));
  },

  addSavedQuiz: (quiz: SavedQuiz): void => {
    const quizzes = StorageUtils.getSavedQuizzes();
    quizzes.push(quiz);
    StorageUtils.saveSavedQuizzes(quizzes);
  },

  updateSavedQuiz: (updatedQuiz: SavedQuiz): void => {
    const quizzes = StorageUtils.getSavedQuizzes();
    const index = quizzes.findIndex(q => q.id === updatedQuiz.id);
    if (index !== -1) {
      quizzes[index] = updatedQuiz;
      StorageUtils.saveSavedQuizzes(quizzes);
    }
  },

  deleteSavedQuiz: (quizId: string): void => {
    const quizzes = StorageUtils.getSavedQuizzes();
    const filteredQuizzes = quizzes.filter(q => q.id !== quizId);
    StorageUtils.saveSavedQuizzes(filteredQuizzes);
  },

  getSavedQuizById: (quizId: string): SavedQuiz | null => {
    const quizzes = StorageUtils.getSavedQuizzes();
    return quizzes.find(q => q.id === quizId) || null;
  },

  // Migration function to convert old individual questions to saved quizzes
  migrateQuestionsToSavedQuizzes: (): void => {
    const questions = StorageUtils.getQuestions();
    const savedQuizzes = StorageUtils.getSavedQuizzes();
    
    // Group questions that don't belong to predefined categories
    const predefinedCategories = ['general-knowledge', 'science', 'history', 'sports'];
    const customQuestions = questions.filter(q => !predefinedCategories.includes(q.category));
    
    if (customQuestions.length > 0) {
      // Check if we already have a migrated quiz
      const existingMigratedQuiz = savedQuizzes.find(q => q.title === 'Migrated Quiz');
      
      if (!existingMigratedQuiz) {
        const migratedQuiz: SavedQuiz = {
          id: QuizUtils.generateId(),
          title: 'Migrated Quiz',
          questions: customQuestions,
          createdAt: Date.now(),
          description: `Migrated quiz with ${customQuestions.length} questions`
        };
        
        StorageUtils.addSavedQuiz(migratedQuiz);
        
        // Remove the migrated questions from individual questions
        const remainingQuestions = questions.filter(q => predefinedCategories.includes(q.category));
        StorageUtils.saveQuestions(remainingQuestions);
      }
    }
  },

  // Get questions with user answers for PDF generation
  getQuestionsWithAnswers: (sessionId: string): any[] => {
    console.log('Getting questions with answers for sessionId:', sessionId);
    
    try {
      // First try to get from current session
      const currentSession = StorageUtils.getCurrentSession();
      console.log('Current session:', currentSession);
      
      // Then try to get from saved sessions
      const sessions = StorageUtils.getSessions();
      console.log('All sessions:', sessions);
      
      let session: QuizSession | null = null;
      
      if (sessionId) {
        session = sessions.find((s: QuizSession) => s.id === sessionId) || null;
        console.log('Found session by ID:', session);
      }
      
      // Fallback to current session
      if (!session) {
        session = currentSession;
        console.log('Using current session as fallback:', session);
      }
      
      if (!session) {
        console.error('No session found');
        return [];
      }

      if (!session.questions || !Array.isArray(session.questions)) {
        console.error('Session has no questions array:', session);
        return [];
      }

      console.log('Processing', session.questions.length, 'questions');
      console.log('Session answers:', session.answers);

      return session.questions.map((question: QuizQuestion) => {
        const userAnswer = session && session.answers && session.answers[question.id] ? session.answers[question.id] : 'Not answered';
        const isCorrect = userAnswer !== 'Not answered' && userAnswer === question.correctAnswer;
        
        console.log(`Question ${question.id}: userAnswer=${userAnswer}, correctAnswer=${question.correctAnswer}, isCorrect=${isCorrect}`);
        
        return {
          ...question,
          userAnswer,
          isCorrect
        };
      });
    } catch (error) {
      console.error('Error in getQuestionsWithAnswers:', error);
      return [];
    }
  },

  // Storage management functions
  clearAllData: (): void => {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('All quiz data cleared from storage');
  },

  getStorageInfo: (): { totalSize: number; itemCount: number; items: { [key: string]: number } } => {
    const items: { [key: string]: number } = {};
    let totalSize = 0;
    let itemCount = 0;

    Object.entries(STORAGE_KEYS).forEach(([keyName, storageKey]) => {
      const item = localStorage.getItem(storageKey);
      if (item) {
        const size = item.length + storageKey.length;
        items[keyName] = size;
        totalSize += size;
        itemCount++;
      }
    });

    return { totalSize, itemCount, items };
  }
};

// Quiz utilities
export const QuizUtils = {
  generateId: (): string => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  },

  shuffleArray: <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  selectQuestions: (
    questions: QuizQuestion[],
    count: number,
    mode: 'random' | 'sequential'
  ): QuizQuestion[] => {
    if (mode === 'random') {
      return QuizUtils.shuffleArray(questions).slice(0, count);
    } else {
      return questions.slice(0, count);
    }
  },

  calculateResults: (session: QuizSession): QuizResult => {
    console.log('=== CALCULATE RESULTS DEBUG ===');
    console.log('Input session:', session);
    console.log('Session questions count:', session.questions.length);
    console.log('Session questions array:', session.questions);
    console.log('Session answers:', session.answers);
    console.log('=== END INPUT DEBUG ===');

    const { questions, answers, startTime, endTime, categoryId } = session;
    const categories = StorageUtils.getCategories();
    const category = categories.find(c => c.id === categoryId);
    
    console.log('=== PROCESSING DEBUG ===');
    console.log('Questions to process:', questions.length);
    console.log('Category found:', category);
    console.log('=== END PROCESSING DEBUG ===');
    
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let skippedQuestions = 0;
    let totalMarks = 0;
    
    const detailedResults = questions.map((question, index) => {
      console.log(`Processing question ${index + 1}:`, question);
      const userAnswer = answers[question.id];
      const isCorrect = userAnswer === question.correctAnswer;
      let marksAwarded = 0;
      
      if (!userAnswer) {
        skippedQuestions++;
        marksAwarded = 0; // No marks for skipped questions
      } else if (isCorrect) {
        correctAnswers++;
        marksAwarded = 4; // +4 marks for correct answer
      } else {
        incorrectAnswers++;
        marksAwarded = -1; // -1 mark for wrong answer
      }
      
      totalMarks += marksAwarded;
      
      const result = {
        questionId: question.id,
        question: question.question,
        options: question.options,
        imageUrl: question.imageUrl, // Include image URL in results!
        userAnswer: userAnswer || 'Not answered',
        correctAnswer: question.correctAnswer,
        isCorrect,
        marksAwarded
      };
      
      console.log(`Question ${index + 1} result:`, result);
      return result;
    });
    
    const totalQuestions = questions.length;
    const maxMarks = totalQuestions * 4; // Maximum possible marks
    const score = correctAnswers;
    const percentage = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;
    const timeTaken = endTime ? endTime - startTime : 0;

    const finalResult = {
      sessionId: session.id,
      categoryName: category?.name || 'Unknown Category',
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      skippedQuestions,
      score,
      percentage,
      totalMarks,
      maxMarks,
      timeTaken,
      detailedResults
    };

    console.log('=== FINAL RESULT DEBUG ===');
    console.log('Final result:', finalResult);
    console.log('Total questions in result:', finalResult.totalQuestions);
    console.log('Detailed results count:', finalResult.detailedResults.length);
    console.log('=== END CALCULATE RESULTS DEBUG ===');
    
    return finalResult;
  },

  formatTime: (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }
};

// Image handling utilities
export const ImageUtils = {
  // Handle file upload
  handleFileUpload: (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!ImageUtils.isValidImageFile(file)) {
        reject(new Error('Invalid file type. Please upload an image file.'));
        return;
      }
      
      if (file.size > 16 * 1024 * 1024) { // 16MB limit
        reject(new Error('File size too large. Please upload a file smaller than 16MB.'));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  },

  // Handle clipboard paste
  handleClipboardPaste: async (event: ClipboardEvent): Promise<string> => {
    const items = event.clipboardData?.items;
    if (!items) {
      throw new Error('No clipboard data available.');
    }
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          return await ImageUtils.handleFileUpload(file);
        }
      }
    }
    
    throw new Error('No image found in clipboard.');
  },

  // Validate image file
  isValidImageFile: (file: File): boolean => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp', 'image/webp'];
    return validTypes.includes(file.type);
  },

  // Generate filename
  generateFileName: (originalName: string): string => {
    const timestamp = Date.now();
    const extension = originalName.split('.').pop();
    return `image_${timestamp}.${extension}`;
  }
};
