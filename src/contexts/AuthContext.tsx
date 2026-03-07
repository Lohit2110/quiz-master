import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { cloudSync } from '../services/CloudSyncService';
import { localFileSystem } from '../services/LocalFileSystemService';
import { realTimeQuizService } from '../services/RealTimeQuizService';

interface User {
  id: string;
  role: 'student' | 'teacher' | 'admin';
  passcode: string;
  loginTime: number;
  sessionId: string;
  deviceInfo: string;
  lastActivity: number;
  studentInfo?: {
    name: string;
    email?: string;
    phone?: string;
    class?: string;
  };
}

interface AuthContextType {
  user: User | null;
  login: (passcode: string, studentInfo?: any) => boolean;
  logout: () => void;
  isLoggedIn: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  showStoragePermission: boolean;
  setShowStoragePermission: (show: boolean) => void;
  updateLastActivity: () => void;
  getActiveStudentsCount: () => number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Predefined passcodes and roles
const PASSCODES = {
  'Lohit9957@': 'admin', // Admin passcode - Full access
  'Student1234': 'student' // Student passcode - Limited access (Home + Take Quiz only)
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [showStoragePermission, setShowStoragePermission] = useState(false);

  // Initialize real-time service on mount
  useEffect(() => {
    realTimeQuizService.initialize();
    localStorage.setItem('quiz_master_start_time', Date.now().toString());
    
    return () => {
      realTimeQuizService.cleanup();
    };
  }, []);

  useEffect(() => {
    // Check for existing login session
    const savedUser = localStorage.getItem('quiz_master_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        // Check if session is still valid (24 hours)
        if (Date.now() - userData.loginTime < 24 * 60 * 60 * 1000) {
          setUser(userData);
        } else {
          // Session expired
          localStorage.removeItem('quiz_master_user');
        }
      } catch (error) {
        localStorage.removeItem('quiz_master_user');
      }
    }
  }, []);

  const login = (passcode: string, studentInfo?: any): boolean => {
    const role = PASSCODES[passcode as keyof typeof PASSCODES];
    
    if (role) {
      // Generate session info
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const deviceInfo = `${navigator.platform} - ${navigator.userAgent.substring(0, 50)}...`;
      
      const newUser: User = {
        id: `user_${Date.now()}`,
        role: role as 'student' | 'teacher' | 'admin',
        passcode,
        loginTime: Date.now(),
        sessionId,
        deviceInfo,
        lastActivity: Date.now(),
        studentInfo: studentInfo || undefined
      };
      
      setUser(newUser);
      localStorage.setItem('quiz_master_user', JSON.stringify(newUser));
      
      // Initialize services based on role
      if (role === 'teacher' || role === 'admin') {
        console.log('Admin/Teacher logged in - Full access enabled');
        
        // Skip storage permission - use standard browser storage like Physics Wallah
        console.log('Using standard browser storage (like Physics Wallah)');
        
        // Sync local to cloud (fallback)
        cloudSync.syncLocalToCloud().catch(console.error);
      } else {
        console.log('Student logged in - Registering for real-time updates');
        
        // Register student for real-time quiz updates (like Physics Wallah)
        const studentData = {
          id: newUser.id,
          name: studentInfo?.name || 'Anonymous Student',
          email: studentInfo?.email || '',
          phone: studentInfo?.phone || '',
          class: studentInfo?.class || '',
          loginTime: Date.now(),
          sessionId: newUser.sessionId
        };
        
        // Register for real-time updates
        realTimeQuizService.registerStudent(newUser.id, studentData, (quizzes) => {
          // QuizContext handles quiz state - don't save to localStorage
          console.log(`📚 Received ${quizzes.length} quizzes from real-time service`);
          
          // Trigger update event for components
          window.dispatchEvent(new CustomEvent('realTimeQuizUpdate', {
            detail: { quizzes, studentCount: realTimeQuizService.getActiveStudentsCount() }
          }));
        });
        
        // Use standard browser storage (no permission needed)
        console.log('Using standard browser storage (like Physics Wallah)');
      }
      
      return true;
    }
    
    return false;
  };

  const logout = () => {
    if (user && user.role === 'student') {
      // Unregister student from real-time updates
      realTimeQuizService.unregisterStudent(user.id);
    }
    
    setUser(null);
    localStorage.removeItem('quiz_master_user');
    // Clear any sync data
    console.log('User logged out');
  };

  // Update user's last activity
  const updateLastActivity = () => {
    if (user) {
      const updatedUser = { ...user, lastActivity: Date.now() };
      setUser(updatedUser);
      localStorage.setItem('quiz_master_user', JSON.stringify(updatedUser));
    }
  };

  // Get active students count
  const getActiveStudentsCount = (): number => {
    return realTimeQuizService.getActiveStudentsCount();
  };

  const authValue: AuthContextType = {
    user,
    login,
    logout,
    isLoggedIn: !!user,
    isTeacher: user?.role === 'teacher' || user?.role === 'admin',
    isStudent: user?.role === 'student',
    showStoragePermission,
    setShowStoragePermission,
    updateLastActivity,
    getActiveStudentsCount
  };

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
