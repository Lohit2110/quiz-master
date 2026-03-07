// Firebase Realtime Quiz Hooks - Instant Updates
import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  getDocs 
} from 'firebase/firestore';
import { db, COLLECTIONS } from '../config/firebase';

// Quiz interface
export interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  published: boolean;
  version: number;
  createdBy: string;
  createdAt: any;
  publishedAt?: any;
  settings?: {
    timeLimit?: number;
    allowRetake?: boolean;
    showResults?: boolean;
  };
}

export interface QuizQuestion {
  id: string;
  type: 'mcq' | 'text';
  text: string;
  options?: string[];
  correctIndex?: number;
  correctAnswer?: string;
  explanation?: string;
  points?: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  userName: string;
  answers: {
    questionId: string;
    selected?: number;
    textAnswer?: string;
  }[];
  status: 'in_progress' | 'submitted' | 'graded';
  score?: number;
  startedAt: any;
  submittedAt?: any;
  gradedAt?: any;
}

// Hook: Realtime Published Quizzes (Student View)
export const usePublishedQuizzes = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ✅ FIXED: Removed orderBy to avoid composite index requirement
    // We'll sort in memory instead
    const q = query(
      collection(db, COLLECTIONS.QUIZZES),
      where('published', '==', true)
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const quizData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Quiz[];
        
        // Sort by publishedAt in memory (newest first)
        quizData.sort((a, b) => {
          const aTime = a.publishedAt?.toMillis?.() || a.publishedAt || 0;
          const bTime = b.publishedAt?.toMillis?.() || b.publishedAt || 0;
          return bTime - aTime;
        });
        
        setQuizzes(quizData);
        setLoading(false);
        
        console.log('📚 Realtime quizzes updated:', quizData.length);
        console.log('📋 Quiz titles:', quizData.map(q => q.title));
      },
      (err) => {
        console.error('❌ Error listening to quizzes:', err);
        console.error('❌ Error code:', (err as any).code);
        console.error('❌ Error message:', (err as any).message);
        setError('Failed to load quizzes');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { quizzes, loading, error };
};

// Hook: All Quizzes (Admin View)
export const useAllQuizzes = (userId?: string) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.QUIZZES),
      where('createdBy', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const quizData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Quiz[];
        
        setQuizzes(quizData);
        setLoading(false);
        
        console.log('📝 Admin quizzes updated:', quizData.length);
      },
      (err) => {
        console.error('❌ Error listening to admin quizzes:', err);
        setError('Failed to load quizzes');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { quizzes, loading, error };
};

// Hook: Quiz Attempts (Admin Analytics)
export const useQuizAttempts = (quizId?: string) => {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!quizId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.ATTEMPTS),
      where('quizId', '==', quizId),
      orderBy('startedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const attemptData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as QuizAttempt[];
        
        setAttempts(attemptData);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [quizId]);

  return { attempts, loading };
};

// Quiz Actions
export const useQuizActions = () => {
  // Create new quiz
  const createQuiz = async (quizData: Omit<Quiz, 'id' | 'createdAt' | 'publishedAt'>) => {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.QUIZZES), {
        ...quizData,
        createdAt: serverTimestamp(),
        published: false,
        version: 1
      });
      
      console.log('✅ Quiz created:', docRef.id);
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('❌ Error creating quiz:', error);
      return { success: false, error: 'Failed to create quiz' };
    }
  };

  // Publish quiz (Real-time notification trigger)
  const publishQuiz = async (quizId: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.QUIZZES, quizId), {
        published: true,
        publishedAt: serverTimestamp()
      });
      
      console.log('📢 Quiz published:', quizId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error publishing quiz:', error);
      return { success: false, error: 'Failed to publish quiz' };
    }
  };

  // Unpublish quiz
  const unpublishQuiz = async (quizId: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.QUIZZES, quizId), {
        published: false,
        publishedAt: null
      });
      
      console.log('📝 Quiz unpublished:', quizId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error unpublishing quiz:', error);
      return { success: false, error: 'Failed to unpublish quiz' };
    }
  };

  // Update quiz
  const updateQuiz = async (quizId: string, updates: Partial<Quiz>) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.QUIZZES, quizId), {
        ...updates,
        version: (updates.version || 1) + 1
      });
      
      console.log('✏️ Quiz updated:', quizId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating quiz:', error);
      return { success: false, error: 'Failed to update quiz' };
    }
  };

  // Delete quiz
  const deleteQuiz = async (quizId: string) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.QUIZZES, quizId));
      
      console.log('🗑️ Quiz deleted:', quizId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting quiz:', error);
      return { success: false, error: 'Failed to delete quiz' };
    }
  };

  return {
    createQuiz,
    publishQuiz,
    unpublishQuiz,
    updateQuiz,
    deleteQuiz
  };
};

// Quiz Attempt Actions
export const useQuizAttemptActions = () => {
  // Start quiz attempt
  const startAttempt = async (quizId: string, userId: string, userName: string) => {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.ATTEMPTS), {
        quizId,
        userId,
        userName,
        answers: [],
        status: 'in_progress',
        startedAt: serverTimestamp()
      });
      
      console.log('▶️ Quiz attempt started:', docRef.id);
      return { success: true, attemptId: docRef.id };
    } catch (error) {
      console.error('❌ Error starting attempt:', error);
      return { success: false, error: 'Failed to start quiz' };
    }
  };

  // Submit quiz attempt
  const submitAttempt = async (
    attemptId: string, 
    answers: QuizAttempt['answers'],
    score?: number
  ) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.ATTEMPTS, attemptId), {
        answers,
        status: score !== undefined ? 'graded' : 'submitted',
        submittedAt: serverTimestamp(),
        ...(score !== undefined && { 
          score, 
          gradedAt: serverTimestamp() 
        })
      });
      
      console.log('✅ Quiz attempt submitted:', attemptId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error submitting attempt:', error);
      return { success: false, error: 'Failed to submit quiz' };
    }
  };

  return {
    startAttempt,
    submitAttempt
  };
};

// Analytics Hook
export const useQuizAnalytics = () => {
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    publishedQuizzes: 0,
    totalAttempts: 0,
    averageScore: 0
  });

  const loadAnalytics = async (userId: string) => {
    try {
      // Get quiz counts
      const quizzesQuery = query(
        collection(db, COLLECTIONS.QUIZZES),
        where('createdBy', '==', userId)
      );
      const quizzesSnapshot = await getDocs(quizzesQuery);
      const quizzes = quizzesSnapshot.docs.map(doc => doc.data());
      
      const totalQuizzes = quizzes.length;
      const publishedQuizzes = quizzes.filter(q => q.published).length;

      // Get attempt stats
      const attemptsSnapshot = await getDocs(collection(db, COLLECTIONS.ATTEMPTS));
      const attempts = attemptsSnapshot.docs.map(doc => doc.data());
      
      const userQuizIds = quizzesSnapshot.docs.map(doc => doc.id);
      const userAttempts = attempts.filter(a => userQuizIds.includes(a.quizId));
      
      const totalAttempts = userAttempts.length;
      const gradedAttempts = userAttempts.filter(a => a.status === 'graded' && a.score !== undefined);
      const averageScore = gradedAttempts.length > 0 
        ? gradedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / gradedAttempts.length 
        : 0;

      setStats({
        totalQuizzes,
        publishedQuizzes,
        totalAttempts,
        averageScore: Math.round(averageScore * 100) / 100
      });
    } catch (error) {
      console.error('❌ Error loading analytics:', error);
    }
  };

  return { stats, loadAnalytics };
};