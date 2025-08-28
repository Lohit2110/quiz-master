import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

// Components
import Navigation from './components/Navigation';
import HomePage from './components/HomePage';
import QuizCategories from './components/QuizCategories';
import CreateQuiz from './components/CreateQuiz';
import Quiz from './components/Quiz';
import QuizResults from './components/QuizResults';
import SimpleAdmin from './components/SimpleAdmin';
import QuizRecovery from './components/QuizRecovery';

// Utils
import { StorageUtils } from './utils/storage';

function App() {
  // Initialize storage on app start
  useEffect(() => {
    // Commented out to preserve existing data
    // StorageUtils.safeInitialize();
  }, []);

  return (
    <Router>
      <div className="App">
        <Navigation />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/quiz-categories" element={<QuizCategories />} />
            <Route path="/create-quiz" element={<CreateQuiz />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/quiz-results" element={<QuizResults />} />
            <Route path="/admin" element={<SimpleAdmin />} />
            <Route path="/recovery" element={<QuizRecovery />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        
        {/* Footer */}
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
                  <span className="text-white text-decoration-none" role="button" onClick={() => window.location.href = '/create-quiz'}>
                    <i className="fas fa-plus me-1"></i>
                    Create Quiz
                  </span>
                  <span className="text-white text-decoration-none" role="button" onClick={() => window.location.href = '/admin'}>
                    <i className="fas fa-cog me-1"></i>
                    Admin
                  </span>
                </div>
                <hr className="border-light" />
                <small className="text-light">
                  © 2025 Quiz Master. Built with React.js, Bootstrap 5, and modern web technologies.
                </small>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
