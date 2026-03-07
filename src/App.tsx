import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

// Contexts
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { QuizProvider } from './contexts/QuizContext';

// Components
import Navigation from './components/Navigation';
import HomePage from './components/HomePage';
import QuizCategories from './components/QuizCategories';
import CreateQuiz from './components/CreateQuiz';
import EditQuiz from './components/EditQuiz';
import Quiz from './components/Quiz';
import QuizResults from './components/QuizResults';
import AdminPanel from './components/AdminPanel';
import QuizRecovery from './components/QuizRecovery';
import DataManager from './components/DataManager';
import PhysicsWallahAuth from './components/PhysicsWallahAuth';
import StoragePermissionModal from './components/StoragePermissionModal';

// Utils
import { StorageUtils } from './utils/storage';

function AppContent() {
  const location = useLocation();
  const isQuizPage = location.pathname === '/quiz';
  const { isLoggedIn, user, showStoragePermission, setShowStoragePermission } = useAuth();

  // Redirect to login if not logged in
  if (!isLoggedIn) {
    return <PhysicsWallahAuth />;
  }

  // Role-based access control
  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';

  const handleStoragePermissionGranted = () => {
    setShowStoragePermission(false);
    console.log('Storage permission granted');
  };

  const handleStoragePermissionDenied = () => {
    setShowStoragePermission(false);
    console.log('Storage permission denied - continuing with browser storage');
  };

  return (
    <>
      <Navigation />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/quiz-categories" element={<QuizCategories />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/quiz-results" element={<QuizResults />} />
          <Route path="/data-sync" element={<DataManager />} />
          
          {/* Admin-only routes */}
          {isAdmin ? (
            <>
              <Route path="/create-quiz" element={<CreateQuiz />} />
              <Route path="/edit-quiz/:quizId" element={<EditQuiz />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/recovery" element={<QuizRecovery />} />
            </>
          ) : (
            <>
              <Route path="/create-quiz" element={<Navigate to="/" replace />} />
              <Route path="/edit-quiz/:quizId" element={<Navigate to="/" replace />} />
              <Route path="/admin" element={<Navigate to="/" replace />} />
              <Route path="/recovery" element={<Navigate to="/" replace />} />
            </>
          )}
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      
      {/* Footer - Hide during quiz */}
      {!isQuizPage && (
        <footer className="bg-dark text-white text-center py-4 mt-5">
          <div className="container">
            <div className="row">
              <div className="col">
                <h5 className="fw-bold mb-3">
                  <i className="fas fa-brain me-2"></i>
                  Quiz Master
                </h5>
                <p className="mb-3">
                  The ultimate quiz creation and management platform
                </p>
                <div className="d-flex justify-content-center gap-3 mb-3">
                  <span className="text-white text-decoration-none" role="button" onClick={() => window.location.href = '/'}>
                    <i className="fas fa-home me-1"></i>
                    Home
                  </span>
                  <span className="text-white text-decoration-none" role="button" onClick={() => window.location.href = '/quiz-categories'}>
                    <i className="fas fa-play me-1"></i>
                    Take Quiz
                  </span>
                  {isAdmin && (
                    <span className="text-white text-decoration-none" role="button" onClick={() => window.location.href = '/create-quiz'}>
                      <i className="fas fa-plus me-1"></i>
                      Create Quiz
                    </span>
                  )}
                  <span className="text-white text-decoration-none" role="button" onClick={() => window.location.href = '/data-sync'}>
                    <i className="fas fa-sync-alt me-1"></i>
                    Data Sync
                  </span>
                  {isAdmin && (
                    <span className="text-white text-decoration-none" role="button" onClick={() => window.location.href = '/admin'}>
                      <i className="fas fa-cog me-1"></i>
                      Admin
                    </span>
                  )}
                </div>
                <hr className="border-light" />
                <small className="text-light">
                  © 2025 Quiz Master. Built with React.js, Bootstrap 5, and modern web technologies.
                </small>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Storage Permission Modal - Disabled for Physics Wallah-like experience */}
      {/* Standard browser storage used instead - no permission needed */}
      {false && (
        <StoragePermissionModal
          show={showStoragePermission}
          onPermissionGranted={handleStoragePermissionGranted}
          onPermissionDenied={handleStoragePermissionDenied}
          userRole={user?.role === 'admin' ? 'admin' : 'student'}
        />
      )}
    </>
  );
}

function App() {
  // Initialize app with new Real OTP system
  useEffect(() => {
    const currentVersion = '3.0.0'; // Real OTP System
    const lastVersion = localStorage.getItem('quiz_master_version');
    
    if (lastVersion !== currentVersion) {
      // Preserve registered students from both old and new systems
      const oldStudents = localStorage.getItem('quiz_master_registered_students');
      const newStudents = localStorage.getItem('quiz_master_students_v2');
      const savedQuizzes = localStorage.getItem('quiz_master_saved_quizzes');
      const studentResults = localStorage.getItem('quiz_master_student_results');
      
      // FORCE LOGOUT ALL USERS (clear authentication)
      localStorage.removeItem('quiz_master_auth');
      sessionStorage.clear();
      
      // Restore preserved data
      if (oldStudents) {
        localStorage.setItem('quiz_master_registered_students', oldStudents);
      }
      if (newStudents) {
        localStorage.setItem('quiz_master_students_v2', newStudents);
      }
      if (savedQuizzes) {
        localStorage.setItem('quiz_master_saved_quizzes', savedQuizzes);
      }
      if (studentResults) {
        localStorage.setItem('quiz_master_student_results', studentResults);
      }
      
      // Set new version
      localStorage.setItem('quiz_master_version', currentVersion);
      
      console.log('🚀 Quiz Master v3.0.0 - Real SMS & Email OTP System!');
      console.log('🚪 All users logged out - Please register/login again');
    }
    
    // Initialize storage on app start
    StorageUtils.safeInitialize();
  }, []);

  return (
    <AuthProvider>
      <QuizProvider>
        <Router>
          <div className="App">
            <AppContent />
          </div>
        </Router>
      </QuizProvider>
    </AuthProvider>
  );
}

export default App;
