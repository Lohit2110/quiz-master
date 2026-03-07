import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import QuizBuilder from './QuizBuilder';
import { useAuth } from '../contexts/AuthContext';
import { cloudSync } from '../services/CloudSyncService';
import { localFileSystem } from '../services/LocalFileSystemService';
import { realTimeQuizService } from '../services/RealTimeQuizService';
import QuizBackupService from '../services/QuizBackupService';
import { EnhancedCloudSync } from '../services/EnhancedCloudSync';
import './Quiz.css';

const CreateQuiz: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Only admin can access create quiz
  if (!isAdmin) {
    return (
      <Container className="py-5 text-center">
        <Card className="shadow-sm">
          <Card.Body className="p-5">
            <i className="fas fa-lock fa-3x text-warning mb-3"></i>
            <h4>Access Restricted</h4>
            <p className="text-muted">
              Only administrators can create quizzes. Please login with admin credentials.
            </p>
            <Button variant="primary" href="/">
              Go to Home
            </Button>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return <CreateQuizContent />;
};

const CreateQuizContent: React.FC = () => {
  const navigate = useNavigate();
  const [showBuilder, setShowBuilder] = useState(false);
  
  // Form state
  const [quizTitle, setQuizTitle] = useState('');
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);
  const [subject, setSubject] = useState(''); // New: Subject field
  const [chapters, setChapters] = useState(''); // New: Chapters field (comma-separated)
  const [alert, setAlert] = useState<{ type: 'success' | 'danger', message: string } | null>(null);

  const handleCreateQuiz = () => {
    // Validation
    if (numberOfQuestions < 1 || numberOfQuestions > 50) {
      showErrorMessage('Please select between 1 and 50 questions');
      return;
    }

    // Proceed to quiz builder
    setShowBuilder(true);
  };

  const handleBuilderSuccess = async (savedQuiz?: any) => {
    if (!savedQuiz) {
      showSuccessMessage('Quiz created successfully!');
      return;
    }

    try {
      console.log('💾 Starting quiz save process...');
      let savedLocations: string[] = [];

      // 🔒 STEP 1: ALWAYS save to localStorage first (PRIMARY storage)
      try {
        const localSaved = await localFileSystem.saveQuizToLocal(savedQuiz);
        if (localSaved) {
          savedLocations.push('Local Storage');
          console.log('✅ Quiz saved to localStorage');
          
          // Create automatic backup
          QuizBackupService.createLocalBackup(savedQuiz);
          console.log('✅ Local backup created');
        }
      } catch (error) {
        console.error('❌ Local storage failed:', error);
        showErrorMessage('❌ CRITICAL: Failed to save quiz locally!');
        return; // Don't proceed if local save fails
      }

      // 🌐 STEP 2: Try to save to Firebase Storage (if images exist)
      let firebaseStorageSaved = false;
      try {
        // Firebase Storage upload happens automatically in ImageUtils.handleFileUpload
        // Images are already uploaded to Firebase Storage when user selects them
        console.log('✅ Images already in Firebase Storage (if any)');
        firebaseStorageSaved = true;
      } catch (error) {
        console.error('⚠️ Firebase Storage check failed:', error);
      }

      // ☁️ STEP 3: Try to save to Firebase Firestore (SECONDARY storage)
      try {
        console.log('🔄 Attempting to save quiz to Firebase Firestore (Enhanced - Unlimited Questions)...');
        // Mark quiz as DRAFT (not published) by default
        const quizToSave = { ...savedQuiz, published: false };
        const cloudSaved = await EnhancedCloudSync.saveQuizUnlimited(quizToSave);
        if (cloudSaved) {
          savedLocations.push('Firebase Cloud');
          console.log(`✅ Quiz saved to Firebase Firestore successfully! (${savedQuiz.questions.length} questions in chunks)`);
        } else {
          console.warn('⚠️ Firebase Firestore save returned false');
        }
      } catch (error) {
        console.error('⚠️ Firebase Firestore save failed:', error);
        // Don't show error - local save succeeded
      }

      // 📢 STEP 4: Publish to active students
      try {
        const published = realTimeQuizService.publishQuizToAllStudents(savedQuiz);
        if (published) {
          const activeStudents = realTimeQuizService.getActiveStudentsCount();
          savedLocations.push(`Published to ${activeStudents} students`);
        }
      } catch (error) {
        console.error('⚠️ Real-time publish failed:', error);
      }

      // ✅ Show success message with save locations
      const fileSize = QuizBackupService.getQuizFileSize(savedQuiz);
      showSuccessMessage(
        `✅ Quiz "${savedQuiz.title}" saved successfully!\n\n` +
        `💾 Saved to: ${savedLocations.join(', ')}\n` +
        `📦 Size: ${fileSize}\n` +
        `📸 Images: ${savedQuiz.questions.filter((q: any) => q.imageUrl).length}\n\n` +
        `${firebaseStorageSaved ? '🚀 Using Firebase Storage (unlimited capacity!)' : '💡 Tip: Update Firebase Storage rules for unlimited capacity'}`
      );

      // Show reminder about backup
      setTimeout(() => {
        showSuccessMessage(
          `💡 Quiz saved locally! You can also:\n` +
          `• Export as file (Admin Panel → Export All)\n` +
          `• Import on another device\n` +
          `• Quiz is safe even if browser clears data`
        );
      }, 3000);

    } catch (error) {
      console.error('❌ Error in quiz save process:', error);
      showErrorMessage('Error occurred, but quiz should be in local storage');
    }
    
    setTimeout(() => {
      navigate('/quiz-categories');
    }, 6000);
  };

  const handleBuilderBack = () => {
    setShowBuilder(false);
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const showErrorMessage = (message: string) => {
    setAlert({ type: 'danger', message });
    setTimeout(() => setAlert(null), 5000);
  };

  const showSuccessMessage = (message: string) => {
    setAlert({ type: 'success', message });
    setTimeout(() => setAlert(null), 5000);
  };

  // If builder is shown, render the QuizBuilder component
  if (showBuilder) {
    return (
      <QuizBuilder
        quizTitle={quizTitle}
        numberOfQuestions={numberOfQuestions}
        categoryId="general-knowledge"
        subject={subject} // Pass subject to builder
        chapters={chapters} // Pass chapters to builder
        onBack={handleBuilderBack}
        onSuccess={handleBuilderSuccess}
      />
    );
  }

  return (
    <Container className="py-5">
      {/* Alert Messages */}
      {alert && (
        <Alert variant={alert.type} dismissible onClose={() => setAlert(null)} className="mb-4">
          {alert.message}
        </Alert>
      )}

      {/* Main Card */}
      <Row className="justify-content-center">
        <Col lg={6} md={8}>
          <Card className="border-0 shadow-lg">
            <Card.Body className="p-5">
              {/* Header */}
              <div className="text-center mb-4">
                <div className="mb-3">
                  <div 
                    className="rounded-circle d-inline-flex align-items-center justify-content-center icon-circle"
                  >
                    <i className="fas fa-plus fa-2x"></i>
                  </div>
                </div>
                <h2 className="fw-bold text-primary mb-2">Create New Quiz</h2>
                <p className="text-muted">Build your custom quiz with multiple questions</p>
              </div>

              {/* Form */}
              <Form>
                {/* Quiz Title */}
                <Form.Group className="mb-4">
                  <Form.Label className="fw-bold text-primary">
                    <i className="fas fa-heading me-2"></i>
                    Quiz Title (Optional)
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter quiz title..."
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    className="py-3 large-font"
                  />
                </Form.Group>

                {/* Number of Questions */}
                <Form.Group className="mb-4">
                  <Form.Label className="fw-bold text-primary">
                    <i className="fas fa-list-ol me-2"></i>
                    Number of Questions
                  </Form.Label>
                  <div className="position-relative">
                    <span 
                      className="position-absolute input-prefix"
                    >
                      #
                    </span>
                    <Form.Control
                      type="number"
                      min="1"
                      max="50"
                      value={numberOfQuestions}
                      onChange={(e) => setNumberOfQuestions(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="py-3 padded-input"
                      placeholder="e.g., 5"
                    />
                  </div>
                  <Form.Text className="text-muted">
                    Choose be

                {/* Subject */}
                <Form.Group className="mb-4">
                  <Form.Label className="fw-bold text-primary">
                    <i className="fas fa-book me-2"></i>
                    Subject (Optional)
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g., Physics, Mathematics, Chemistry..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="py-3 large-font"
                  />
                  <Form.Text className="text-muted">
                    Enter the subject name for this quiz
                  </Form.Text>
                </Form.Group>

                {/* Chapters */}
                <Form.Group className="mb-4">
                  <Form.Label className="fw-bold text-primary">
                    <i className="fas fa-bookmark me-2"></i>
                    Chapters (Optional)
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="e.g., Motion, Force, Energy..."
                    value={chapters}
                    onChange={(e) => setChapters(e.target.value)}
                    className="large-font"
                  />
                  <Form.Text className="text-muted">
                    Enter chapter names separated by commas
                  </Form.Text>
                </Form.Group>tween 1 and 50 questions
                  </Form.Text>
                </Form.Group>

                {/* Action Buttons */}
                <div className="d-grid gap-3 mb-4">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleCreateQuiz}
                    className="py-3 gradient-button"
                  >
                    <i className="fas fa-edit me-2"></i>
                    Create New Quiz
                  </Button>
                  
                  <Button
                    variant="outline-secondary"
                    size="lg"
                    onClick={handleBackToHome}
                    className="py-3 large-font"
                  >
                    <i className="fas fa-arrow-left me-2"></i>
                    Back to Home
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Quick Tips Section */}
      <Row className="justify-content-center mt-4">
        <Col lg={6} md={8}>
          <Card className="border-0" style={{ backgroundColor: '#fff3cd' }}>
            <Card.Body className="p-4">
              <h6 className="fw-bold text-warning mb-3">
                <i className="fas fa-lightbulb me-2"></i>
                Quick Tips
              </h6>
              <div className="small text-dark">
                <div className="mb-2">
                  <i className="fas fa-check text-success me-2"></i>
                  Start with fewer questions for your first quiz
                </div>
                <div className="mb-2">
                  <i className="fas fa-check text-success me-2"></i>
                  You can add images to make questions more engaging
                </div>
                <div className="mb-2">
                  <i className="fas fa-check text-success me-2"></i>
                  Mix different question types for variety
                </div>
                <div className="mb-0">
                  <i className="fas fa-check text-success me-2"></i>
                  Preview each question before moving to the next
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default CreateQuiz;
