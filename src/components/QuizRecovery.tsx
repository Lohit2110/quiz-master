import React from 'react';
import { Container, Card, Button, Alert } from 'react-bootstrap';
import { StorageUtils } from '../utils/storage';

const QuizRecovery: React.FC = () => {
  const [message, setMessage] = React.useState<string>('');
  const [messageType, setMessageType] = React.useState<'success' | 'danger' | 'info'>('info');

  const checkSavedQuizzes = () => {
    try {
      const savedQuizzes = StorageUtils.getSavedQuizzes();
      const questions = StorageUtils.getQuestions();
      const categories = StorageUtils.getCategories();
      
      const report = `Storage Report:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Current Data Status:
   • Saved Quizzes: ${savedQuizzes.length}
   • Questions: ${questions.length}
   • Categories: ${categories.length}

🎯 Your Saved Quizzes:
${savedQuizzes.length === 0 ? '   ❌ No saved quizzes found' : 
savedQuizzes.map((quiz, index) => 
  `   ${index + 1}. "${quiz.title}" (${quiz.questions.length} questions)`
).join('\n')}

📂 Available Categories:
${categories.map((cat, index) => 
  `   ${index + 1}. ${cat.name} (${cat.questionCount} questions)`
).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      setMessage(report);
      setMessageType(savedQuizzes.length > 0 ? 'success' : 'info');
    } catch (error) {
      setMessage(`Error checking data: ${error}`);
      setMessageType('danger');
    }
  };

  const recoverData = () => {
    try {
      StorageUtils.safeInitialize();
      setMessage('✅ Data recovery completed! Default content restored.');
      setMessageType('success');
    } catch (error) {
      setMessage(`❌ Recovery failed: ${error}`);
      setMessageType('danger');
    }
  };

  const cleanStorage = () => {
    try {
      const sessions = StorageUtils.getSessions();
      const oldCount = sessions.length;
      
      // Keep only last 3 sessions
      sessions.sort((a, b) => b.startTime - a.startTime);
      const cleanSessions = sessions.slice(0, 3);
      localStorage.setItem('quiz_master_sessions', JSON.stringify(cleanSessions));
      
      setMessage(`🧹 Cleaned up ${oldCount - cleanSessions.length} old sessions. Your quizzes are preserved!`);
      setMessageType('success');
    } catch (error) {
      setMessage(`❌ Cleanup failed: ${error}`);
      setMessageType('danger');
    }
  };

  return (
    <Container className="py-5">
      <Card className="shadow">
        <Card.Header className="bg-primary text-white">
          <h4 className="mb-0">
            <i className="fas fa-first-aid me-2"></i>
            Quiz Data Recovery Tool
          </h4>
        </Card.Header>
        <Card.Body>
          <div className="mb-4">
            <p className="text-muted">
              Use this tool to check your saved quizzes and recover lost data.
            </p>
            
            <div className="d-flex gap-2 flex-wrap mb-4">
              <Button variant="info" onClick={checkSavedQuizzes}>
                <i className="fas fa-search me-1"></i>
                Check My Data
              </Button>
              <Button variant="success" onClick={recoverData}>
                <i className="fas fa-first-aid me-1"></i>
                Recover Default Content
              </Button>
              <Button variant="warning" onClick={cleanStorage}>
                <i className="fas fa-broom me-1"></i>
                Clean Old Sessions
              </Button>
              <Button 
                variant="outline-primary" 
                onClick={() => window.location.href = '/create-quiz'}
              >
                <i className="fas fa-plus me-1"></i>
                Create New Quiz
              </Button>
            </div>

            {message && (
              <Alert variant={messageType}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'monospace' }}>
                  {message}
                </pre>
              </Alert>
            )}
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default QuizRecovery;
