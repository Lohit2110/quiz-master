import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SavedQuiz } from '../types';
import { CloudSyncService } from '../services/CloudSyncService';
import { useAuth } from './AuthContext';

interface QuizContextType {
  quizzes: SavedQuiz[];
  setQuizzes: (quizzes: SavedQuiz[]) => void;
  refreshQuizzes: () => Promise<void>;
  isLoading: boolean;
  lastSyncTime: Date | null;
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

export const useQuizContext = () => {
  const context = useContext(QuizContext);
  if (!context) {
    throw new Error('useQuizContext must be used within QuizProvider');
  }
  return context;
};

interface QuizProviderProps {
  children: ReactNode;
}

export const QuizProvider: React.FC<QuizProviderProps> = ({ children }) => {
  const [quizzes, setQuizzes] = useState<SavedQuiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const cloudSync = new CloudSyncService();
  const auth = useAuth();

  useEffect(() => {
    console.log('🎯 QuizContext: Setting up Firebase real-time listener');
    
    // Determine if current user is admin
    const isAdmin = auth?.user?.role === 'admin';
    console.log('👤 User role:', auth?.user?.role, '| Is Admin:', isAdmin);
    
    // Set up real-time Firebase listener based on user role
    const unsubscribe = isAdmin
      ? cloudSync.subscribeToAllQuizzes((updatedQuizzes) => {
          console.log(`🔄 [ADMIN] QuizContext: Received ${updatedQuizzes.length} total quizzes from Firebase`);
          const publishedCount = updatedQuizzes.filter(q => q.published).length;
          const draftCount = updatedQuizzes.filter(q => !q.published).length;
          console.log(`📊 [ADMIN] Published: ${publishedCount}, Drafts: ${draftCount}`);
          setQuizzes(updatedQuizzes);  // Admin sees ALL quizzes
          setLastSyncTime(new Date());
          setIsLoading(false);
        })
      : cloudSync.subscribeToQuizUpdates((updatedQuizzes) => {
          console.log(`🔄 [STUDENT] QuizContext: Received ${updatedQuizzes.length} published quizzes from Firebase`);
          setQuizzes(updatedQuizzes);  // Students see ONLY published quizzes
          setLastSyncTime(new Date());
          setIsLoading(false);
        });

    // Initial load
    refreshQuizzes();

    return () => {
      console.log('🧹 QuizContext: Cleaning up Firebase listener');
      unsubscribe();
    };
  }, [auth?.user?.role]);  // Re-subscribe when user role changes

  const refreshQuizzes = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 QuizContext: Refreshing quizzes from Firebase');
      await cloudSync.syncCloudToLocal();
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('❌ QuizContext: Error refreshing quizzes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <QuizContext.Provider value={{ quizzes, setQuizzes, refreshQuizzes, isLoading, lastSyncTime }}>
      {children}
    </QuizContext.Provider>
  );
};
