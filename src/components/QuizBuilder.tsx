import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert } from 'react-bootstrap';
import { QuizQuestion, SavedQuiz } from '../types';
import { StorageUtils, QuizUtils, ImageUtils } from '../utils/storage';

interface QuizBuilderProps {
  quizTitle: string;
  numberOfQuestions: number;
  categoryId: string;
  onBack: () => void;
  onSuccess: () => void;
}

interface QuestionFormData {
  question: string;
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  correctAnswer: 'a' | 'b' | 'c' | 'd';
  imageUrl?: string;
}

const QuizBuilder: React.FC<QuizBuilderProps> = ({ 
  quizTitle, 
  numberOfQuestions, 
  categoryId, 
  onBack, 
  onSuccess 
}) => {
  const [questions, setQuestions] = useState<QuestionFormData[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [alert, setAlert] = useState<{ type: 'success' | 'danger', message: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPasteModeEnabled, setIsPasteModeEnabled] = useState(false);

  useEffect(() => {
    initializeQuestions();
  }, []);

  const initializeQuestions = () => {
    const initialQuestions: QuestionFormData[] = [];
    for (let i = 0; i < numberOfQuestions; i++) {
      initialQuestions.push({
        question: '',
        options: { a: 'A', b: 'B', c: 'C', d: 'D' },
        correctAnswer: 'a'
      });
    }
    setQuestions(initialQuestions);
  };

  const updateQuestion = (field: string, value: any) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i === currentQuestionIndex) {
        if (field.startsWith('options.')) {
          const optionKey = field.split('.')[1] as keyof typeof q.options;
          return {
            ...q,
            options: { ...q.options, [optionKey]: value }
          };
        }
        return { ...q, [field]: value };
      }
      return q;
    }));
  };

  const handleImageUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const imageUrl = await ImageUtils.handleFileUpload(file);
      updateQuestion('imageUrl', imageUrl);
      showSuccessMessage('Image uploaded successfully!');
    } catch (error) {
      showErrorMessage(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleImagePaste = async (event: React.ClipboardEvent) => {
    event.preventDefault();
    setIsUploading(true);
    try {
      const imageUrl = await ImageUtils.handleClipboardPaste(event.nativeEvent as ClipboardEvent);
      updateQuestion('imageUrl', imageUrl);
      showSuccessMessage('Image pasted successfully!');
      setIsPasteModeEnabled(false); // Disable paste mode after successful paste
    } catch (error) {
      showErrorMessage(error instanceof Error ? error.message : 'Failed to paste image');
    } finally {
      setIsUploading(false);
    }
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const saveQuiz = () => {
    // Create quiz questions
    const quizQuestions: QuizQuestion[] = questions.map((questionData, index) => ({
      id: QuizUtils.generateId(),
      question: questionData.question.trim() || `Question ${index + 1}`,
      options: {
        a: questionData.options.a.trim() || 'A',
        b: questionData.options.b.trim() || 'B',
        c: questionData.options.c.trim() || 'C',
        d: questionData.options.d.trim() || 'D'
      },
      correctAnswer: questionData.correctAnswer,
      category: categoryId,
      imageUrl: questionData.imageUrl
    }));

    // Create saved quiz
    const savedQuiz: SavedQuiz = {
      id: QuizUtils.generateId(),
      title: quizTitle || 'Untitled Quiz',
      questions: quizQuestions,
      createdAt: Date.now(),
      description: `Custom quiz with ${quizQuestions.length} questions`
    };

    try {
      StorageUtils.addSavedQuiz(savedQuiz);
      onSuccess();
    } catch (error) {
      showErrorMessage('Failed to save quiz. Please try again.');
    }
  };

  const showSuccessMessage = (message: string) => {
    setAlert({ type: 'success', message });
    setTimeout(() => setAlert(null), 5000);
  };

  const showErrorMessage = (message: string) => {
    setAlert({ type: 'danger', message });
    setTimeout(() => setAlert(null), 5000);
  };

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <Container className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="fw-bold text-primary mb-1">
                {quizTitle || 'New Quiz'}
              </h2>
              <p className="text-muted mb-0">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
            </div>
            <Button variant="outline-secondary" onClick={onBack}>
              <i className="fas fa-arrow-left me-2"></i>
              Back to Setup
            </Button>
          </div>
        </Col>
      </Row>

      {/* Progress Bar */}
      <Row className="mb-4">
        <Col>
          <div className="progress" style={{ height: '8px' }}>
            <div 
              className="progress-bar bg-primary" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <small className="text-muted">Progress: {Math.round(progress)}% complete</small>
        </Col>
      </Row>

      {alert && (
        <Alert variant={alert.type} dismissible onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      {/* Question Form */}
      {currentQuestion && (
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-primary text-white">
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold">
                <i className="fas fa-question-circle me-2"></i>
                Question {currentQuestionIndex + 1}
              </h5>
            </div>
          </Card.Header>

          <Card.Body className="p-4">
            <Row className="g-4">
              {/* Correct Answer */}
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-bold">Correct Answer</Form.Label>
                  <Form.Select
                    value={currentQuestion.correctAnswer}
                    onChange={(e) => updateQuestion('correctAnswer', e.target.value)}
                  >
                    <option value="a">A</option>
                    <option value="b">B</option>
                    <option value="c">C</option>
                    <option value="d">D</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={6}>
                {/* Empty column for balance */}
              </Col>

              {/* Question Text */}
              <Col xs={12}>
                <Form.Group>
                  <Form.Label className="fw-bold">Question</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={currentQuestion.question}
                    onChange={(e) => updateQuestion('question', e.target.value)}
                    placeholder="Enter your question here..."
                  />
                </Form.Group>
              </Col>

              {/* Answer Options */}
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-bold">Option A</Form.Label>
                  <Form.Control
                    type="text"
                    value={currentQuestion.options.a}
                    onChange={(e) => updateQuestion('options.a', e.target.value)}
                    placeholder="Enter option A..."
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-bold">Option B</Form.Label>
                  <Form.Control
                    type="text"
                    value={currentQuestion.options.b}
                    onChange={(e) => updateQuestion('options.b', e.target.value)}
                    placeholder="Enter option B..."
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-bold">Option C</Form.Label>
                  <Form.Control
                    type="text"
                    value={currentQuestion.options.c}
                    onChange={(e) => updateQuestion('options.c', e.target.value)}
                    placeholder="Enter option C..."
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-bold">Option D</Form.Label>
                  <Form.Control
                    type="text"
                    value={currentQuestion.options.d}
                    onChange={(e) => updateQuestion('options.d', e.target.value)}
                    placeholder="Enter option D..."
                  />
                </Form.Group>
              </Col>

              {/* Image Upload Section */}
              <Col xs={12}>
                <div className="border rounded p-3 bg-light">
                  <h6 className="fw-bold mb-3">
                    <i className="fas fa-image me-2"></i>
                    Image (Optional)
                  </h6>
                  
                  {currentQuestion.imageUrl ? (
                    <div className="text-center">
                      <img
                        src={currentQuestion.imageUrl}
                        alt="Question"
                        className="img-fluid rounded mb-3"
                        style={{ maxHeight: '200px' }}
                      />
                      <div>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => updateQuestion('imageUrl', undefined)}
                        >
                          <i className="fas fa-trash me-2"></i>
                          Remove Image
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="d-flex gap-2 mb-3">
                        <Button
                          variant="outline-primary"
                          onClick={() => document.getElementById('file-input')?.click()}
                          disabled={isUploading}
                        >
                          <i className="fas fa-upload me-2"></i>
                          Upload Image
                        </Button>
                        <Button
                          variant={isPasteModeEnabled ? "primary" : "outline-secondary"}
                          onClick={() => setIsPasteModeEnabled(!isPasteModeEnabled)}
                          disabled={isUploading}
                        >
                          <i className="fas fa-paste me-2"></i>
                          {isPasteModeEnabled ? "Paste Mode ON" : "Enable Paste"}
                        </Button>
                      </div>

                      {isPasteModeEnabled && (
                        <div
                          className="border border-dashed rounded p-4 text-center mb-3"
                          style={{ cursor: 'text', backgroundColor: '#f8f9fa' }}
                          onPaste={handleImagePaste}
                          tabIndex={0}
                        >
                          {isUploading ? (
                            <div>
                              <i className="fas fa-spinner fa-spin fa-2x text-primary mb-2"></i>
                              <p className="text-muted mb-0">Uploading...</p>
                            </div>
                          ) : (
                            <div>
                              <i className="fas fa-clipboard fa-2x text-success mb-2"></i>
                              <p className="text-muted mb-0">
                                Press <kbd>Ctrl+V</kbd> to paste your image here
                              </p>
                              <small className="text-success">Paste mode is active</small>
                            </div>
                          )}
                        </div>
                      )}

                      {!isPasteModeEnabled && (
                        <div className="border border-dashed rounded p-4 text-center mb-3 text-muted">
                          <i className="fas fa-image fa-2x mb-2"></i>
                          <p className="mb-0">
                            Click "Upload Image" to select a file or "Enable Paste" to paste from clipboard
                          </p>
                        </div>
                      )}

                      <input
                        id="file-input"
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file);
                        }}
                      />

                      <small className="text-muted">
                        Supported formats: PNG, JPG, JPEG, GIF, BMP, WebP (Max: 16MB)
                      </small>
                    </div>
                  )}
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      {/* Navigation */}
      <Row className="mt-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <Button
              variant="outline-secondary"
              onClick={goToPreviousQuestion}
              disabled={currentQuestionIndex === 0}
            >
              <i className="fas fa-chevron-left me-2"></i>
              Previous
            </Button>

            <div className="text-center">
              <small className="text-muted">
                {currentQuestionIndex + 1} of {questions.length} questions
              </small>
            </div>

            <div className="d-flex gap-2">
              {currentQuestionIndex === questions.length - 1 ? (
                <Button variant="success" onClick={saveQuiz}>
                  <i className="fas fa-save me-2"></i>
                  Save Quiz
                </Button>
              ) : (
                <Button variant="primary" onClick={goToNextQuestion}>
                  Next
                  <i className="fas fa-chevron-right ms-2"></i>
                </Button>
              )}
            </div>
          </div>
        </Col>
      </Row>

      {/* Question Overview */}
      <Row className="mt-4">
        <Col>
          <Card className="border-0 bg-light">
            <Card.Body className="p-3">
              <h6 className="fw-bold mb-3">Question Overview</h6>
              <div className="d-flex flex-wrap gap-2">
                {questions.map((q, index) => (
                  <Button
                    key={index}
                    variant={index === currentQuestionIndex ? 'primary' : 
                             q.question.trim() ? 'success' : 'outline-secondary'}
                    size="sm"
                    onClick={() => setCurrentQuestionIndex(index)}
                    className="rounded-circle"
                    style={{ width: '40px', height: '40px' }}
                  >
                    {index + 1}
                  </Button>
                ))}
              </div>
              <small className="text-muted mt-2 d-block">
                <i className="fas fa-info-circle me-1"></i>
                Green: Complete • Blue: Current • Gray: Empty
              </small>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default QuizBuilder;
