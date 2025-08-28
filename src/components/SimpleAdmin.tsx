import React from 'react';
import { Container, Card, Button, Row, Col, Badge } from 'react-bootstrap';

const SimpleAdmin: React.FC = () => {
  const [message, setMessage] = React.useState<string>('Click "Check Storage" to see your data');
  const [savedQuizzes, setSavedQuizzes] = React.useState<any[]>([]);

  React.useEffect(() => {
    loadSavedQuizzes();
  }, []);

  const loadSavedQuizzes = () => {
    try {
      const quizzesData = localStorage.getItem('quiz_master_saved_quizzes');
      if (quizzesData) {
        const quizzes = JSON.parse(quizzesData);
        setSavedQuizzes(quizzes);
      } else {
        setSavedQuizzes([]);
      }
    } catch (error) {
      console.error('Error loading saved quizzes:', error);
      setSavedQuizzes([]);
    }
  };

  const deleteQuiz = (quizId: string, quizTitle: string) => {
    if (window.confirm(`Are you sure you want to delete the quiz "${quizTitle}"? This action cannot be undone.`)) {
      try {
        const updatedQuizzes = savedQuizzes.filter(quiz => quiz.id !== quizId);
        localStorage.setItem('quiz_master_saved_quizzes', JSON.stringify(updatedQuizzes));
        setSavedQuizzes(updatedQuizzes);
        setMessage(`✅ Quiz "${quizTitle}" deleted successfully!`);
      } catch (error) {
        setMessage(`❌ Error deleting quiz: ${error}`);
      }
    }
  };

  const checkStorage = () => {
    try {
      // Check for TEST 2 quiz specifically
      const savedQuizzes = localStorage.getItem('quiz_master_saved_quizzes');
      const questions = localStorage.getItem('quiz_master_questions');
      const categories = localStorage.getItem('quiz_master_categories');
      
      let report = '📊 STORAGE CONTENTS:\n\n';
      
      if (savedQuizzes) {
        const quizzes = JSON.parse(savedQuizzes);
        report += `🎯 SAVED QUIZZES (${quizzes.length} found):\n`;
        quizzes.forEach((quiz: any, index: number) => {
          report += `   ${index + 1}. "${quiz.title}" - ${quiz.questions?.length || 0} questions\n`;
          if (quiz.title.includes('TEST 2')) {
            report += `      ⭐ FOUND YOUR TEST 2 QUIZ! ⭐\n`;
          }
        });
      } else {
        report += '❌ No saved quizzes found\n';
      }
      
      if (questions) {
        const q = JSON.parse(questions);
        report += `\n📝 QUESTIONS: ${q.length} total\n`;
      }
      
      if (categories) {
        const c = JSON.parse(categories);
        report += `📂 CATEGORIES: ${c.length} total\n`;
      }
      
      // Check for other quiz data
      report += '\n🔍 ALL QUIZ-RELATED STORAGE KEYS:\n';
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('quiz')) {
          const value = localStorage.getItem(key);
          report += `   • ${key}: ${value ? Math.round(value.length / 1024) : 0}KB\n`;
        }
      }
      
      setMessage(report);
    } catch (error) {
      setMessage(`Error: ${error}`);
    }
  };

  const restoreWorkingState = () => {
    try {
      // Only restore if no saved quizzes exist
      const savedQuizzes = localStorage.getItem('quiz_master_saved_quizzes');
      if (!savedQuizzes || JSON.parse(savedQuizzes).length === 0) {
        // Initialize with minimal working data
        const defaultCategories = [
          { id: 'general-knowledge', name: 'General Knowledge', description: 'General questions', questionCount: 0 },
          { id: 'custom', name: 'Custom', description: 'Custom questions', questionCount: 0 }
        ];
        
        localStorage.setItem('quiz_master_categories', JSON.stringify(defaultCategories));
        localStorage.setItem('quiz_master_questions', JSON.stringify([]));
        localStorage.setItem('quiz_master_saved_quizzes', JSON.stringify([]));
        
        loadSavedQuizzes(); // Refresh the quiz list
        setMessage('✅ Restored minimal working state. You can now create new quizzes.');
      } else {
        setMessage('⚠️ Saved quizzes detected - not overwriting. Use "Check Storage" to see your data.');
      }
    } catch (error) {
      setMessage(`Restore failed: ${error}`);
    }
  };

  const clearEverything = () => {
    if (window.confirm('⚠️ This will delete ALL quiz data including TEST 2. Are you sure?')) {
      if (window.confirm('FINAL WARNING: This cannot be undone!')) {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('quiz')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        setSavedQuizzes([]);
        setMessage('🗑️ All quiz data cleared.');
      }
    }
  };

  return (
    <Container className="py-5">
      <Card>
        <Card.Header className="bg-danger text-white">
          <h4 className="mb-0">🚨 Emergency Admin Panel</h4>
        </Card.Header>
        <Card.Body>
          <p className="alert alert-warning">
            <strong>Looking for your "TEST 2" quiz?</strong> Use the buttons below to check if it's still in storage.
          </p>
          
          <div className="d-flex gap-2 mb-4 flex-wrap">
            <Button variant="primary" onClick={checkStorage}>
              🔍 Check Storage
            </Button>
            <Button variant="success" onClick={restoreWorkingState}>
              🔧 Restore Working State
            </Button>
            <Button variant="outline-primary" onClick={() => window.location.href = '/create-quiz'}>
              ➕ Create New Quiz
            </Button>
            <Button variant="outline-primary" onClick={() => window.location.href = '/quiz-categories'}>
              🎯 Take Quiz
            </Button>
            <Button variant="danger" onClick={clearEverything}>
              🗑️ Clear All Data
            </Button>
          </div>

          <Card className="bg-light">
            <Card.Body>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', margin: 0 }}>
                {message}
              </pre>
            </Card.Body>
          </Card>

          {/* Individual Quiz Management Section */}
          {savedQuizzes.length > 0 && (
            <Card className="mt-4">
              <Card.Header className="bg-primary text-white">
                <h5 className="mb-0">🎯 Your Saved Quizzes ({savedQuizzes.length})</h5>
              </Card.Header>
              <Card.Body>
                <Row className="g-3">
                  {savedQuizzes.map(quiz => (
                    <Col md={6} lg={4} key={quiz.id}>
                      <Card className="border h-100 shadow-sm">
                        <Card.Body className="d-flex flex-column">
                          <div className="flex-grow-1">
                            <h6 className="fw-bold text-primary mb-2">
                              <i className="fas fa-quiz me-2"></i>
                              {quiz.title}
                            </h6>
                            <p className="text-muted small mb-2">
                              {quiz.description || 'No description available'}
                            </p>
                            <div className="d-flex align-items-center text-muted small">
                              <Badge bg="secondary" className="me-2">
                                {quiz.questions?.length || 0} questions
                              </Badge>
                              <Badge bg="info">
                                {new Date(quiz.createdAt).toLocaleDateString()}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-3 d-flex gap-1">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              className="flex-grow-1"
                              onClick={() => {
                                setMessage(`📋 Quiz: ${quiz.title}\n📝 Questions: ${quiz.questions?.length || 0}\n📅 Created: ${new Date(quiz.createdAt).toLocaleString()}\n📄 Description: ${quiz.description || 'No description'}`);
                              }}
                            >
                              <i className="fas fa-eye me-1"></i>
                              View Details
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => deleteQuiz(quiz.id, quiz.title)}
                              title={`Delete ${quiz.title}`}
                            >
                              <i className="fas fa-trash"></i>
                            </Button>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            </Card>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default SimpleAdmin;
