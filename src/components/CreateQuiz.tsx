import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import QuizBuilder from './QuizBuilder';
import './Quiz.css';

const CreateQuiz: React.FC = () => {
  const navigate = useNavigate();
  const [showBuilder, setShowBuilder] = useState(false);
  
  // Form state
  const [quizTitle, setQuizTitle] = useState('');
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);
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

  const handleBuilderSuccess = () => {
    showSuccessMessage('Quiz created successfully!');
    setTimeout(() => {
      navigate('/quiz-categories');
    }, 2000);
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
                    Choose between 1 and 50 questions
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
