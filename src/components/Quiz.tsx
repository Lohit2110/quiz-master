import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, ProgressBar, Badge } from 'react-bootstrap';
import { QuizSession, QuizQuestion, QuizResult, SavedQuiz } from '../types';
import { StorageUtils, QuizUtils } from '../utils/storage';
import './Quiz.css';

const Quiz: React.FC = () => {
  const [session, setSession] = useState<QuizSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0); // Time left in seconds
  const [timerMinutes, setTimerMinutes] = useState<number>(10); // Timer duration in minutes

  useEffect(() => {
    initializeQuiz();
  }, []);

  // Timer effect
  useEffect(() => {
    if (timeLeft > 0 && session && !session.isCompleted) {
      const timer = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            // Time's up - auto submit quiz
            handleSubmitQuiz();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeLeft, session]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getTimerColor = (): string => {
    const totalSeconds = timerMinutes * 60;
    const percentage = (timeLeft / totalSeconds) * 100;
    
    if (percentage > 50) return 'success';
    if (percentage > 25) return 'warning';
    return 'danger';
  };

  const initializeQuiz = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const savedQuizId = urlParams.get('savedQuiz');
    const timerParam = parseInt(urlParams.get('timer') || '10'); // Default 10 minutes

    setTimerMinutes(timerParam);
    setTimeLeft(timerParam * 60); // Convert minutes to seconds

    if (!savedQuizId) {
      alert('No saved quiz specified');
      window.location.href = '/quiz-categories';
      return;
    }

    // Check for existing session
    const existingSession = StorageUtils.getCurrentSession();
    if (existingSession && 
        existingSession.categoryId === savedQuizId && 
        !existingSession.isCompleted) {
      setSession(existingSession);
      setCurrentQuestion(existingSession.questions[existingSession.currentQuestionIndex]);
      setSelectedAnswer('');
      setIsLoading(false);
      return;
    }

    // Handle saved quiz only
    const savedQuiz = StorageUtils.getSavedQuizById(savedQuizId);
    console.log('Raw saved quiz data:', savedQuiz);
    
    if (!savedQuiz) {
      alert('Saved quiz not found');
      window.location.href = '/quiz-categories';
      return;
    }

    // Use ALL questions from the saved quiz - no limitations
    const questions = savedQuiz.questions;
    
    console.log('=== DETAILED QUIZ DEBUG ===');
    console.log('Saved Quiz ID:', savedQuizId);
    console.log('Saved Quiz Title:', savedQuiz.title);
    console.log('Saved Quiz Created At:', new Date(savedQuiz.createdAt));
    console.log('Raw questions array:', savedQuiz.questions);
    console.log('Questions length:', savedQuiz.questions?.length || 0);
    console.log('Individual questions:');
    savedQuiz.questions?.forEach((q, index) => {
      console.log(`Question ${index + 1}:`, q);
    });
    console.log('Final questions array:', questions);
    console.log('Final questions count:', questions.length);
    console.log('=== END DEBUG ===');

    if (questions.length === 0) {
      alert('No questions available in this quiz');
      window.location.href = '/quiz-categories';
      return;
    }

    const newSession: QuizSession = {
      id: QuizUtils.generateId(),
      categoryId: savedQuizId,
      questions: questions, // Use ALL questions from saved quiz
      currentQuestionIndex: 0,
      answers: {},
      startTime: Date.now(),
      isCompleted: false
    };

    console.log('=== SESSION CREATION DEBUG ===');
    console.log('Session ID:', newSession.id);
    console.log('Session questions count:', newSession.questions.length);
    console.log('Session questions array:', newSession.questions);
    console.log('Complete session object:', newSession);
    console.log('=== END SESSION DEBUG ===');

    setSession(newSession);
    setCurrentQuestion(questions[0]);
    StorageUtils.saveCurrentSession(newSession);
    
    // Verify what was actually saved
    const verifySession = StorageUtils.getCurrentSession();
    console.log('=== VERIFY SAVED SESSION ===');
    console.log('Retrieved session:', verifySession);
    console.log('Retrieved questions count:', verifySession?.questions?.length || 0);
    console.log('Questions with images in session:');
    verifySession?.questions?.forEach((q, index) => {
      if (q.imageUrl) {
        console.log(`  Question ${index + 1}: Has image (${q.imageUrl.substring(0, 50)}...)`);
      }
    });
    console.log('=== END VERIFY ===');
    
    setIsLoading(false);
  };

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
  };

  const handleNext = () => {
    if (!session || !currentQuestion) return;

    // Save answer if selected
    const updatedAnswers = { ...session.answers };
    if (selectedAnswer) {
      updatedAnswers[currentQuestion.id] = selectedAnswer;
    }

    const nextIndex = session.currentQuestionIndex + 1;
    const isLastQuestion = nextIndex >= session.questions.length;

    const updatedSession: QuizSession = {
      ...session,
      answers: updatedAnswers,
      currentQuestionIndex: nextIndex,
      isCompleted: isLastQuestion,
      endTime: isLastQuestion ? Date.now() : session.endTime
    };

    if (isLastQuestion) {
      // Complete quiz
      StorageUtils.saveSession(updatedSession);
      StorageUtils.clearCurrentSession();
      
      // Navigate to results
      const results = QuizUtils.calculateResults(updatedSession);
      sessionStorage.setItem('quiz_results', JSON.stringify(results));
      window.location.href = '/quiz-results';
    } else {
      // Move to next question
      setSession(updatedSession);
      setCurrentQuestion(session.questions[nextIndex]);
      setSelectedAnswer(updatedAnswers[session.questions[nextIndex].id] || '');
      StorageUtils.saveCurrentSession(updatedSession);
    }
  };

  const handlePrevious = () => {
    if (!session || session.currentQuestionIndex === 0) return;

    // Save current answer
    const updatedAnswers = { ...session.answers };
    if (selectedAnswer && currentQuestion) {
      updatedAnswers[currentQuestion.id] = selectedAnswer;
    }

    const prevIndex = session.currentQuestionIndex - 1;
    const updatedSession: QuizSession = {
      ...session,
      answers: updatedAnswers,
      currentQuestionIndex: prevIndex
    };

    setSession(updatedSession);
    setCurrentQuestion(session.questions[prevIndex]);
    setSelectedAnswer(updatedAnswers[session.questions[prevIndex].id] || '');
    StorageUtils.saveCurrentSession(updatedSession);
  };

  const handleQuestionNavigation = (questionIndex: number) => {
    if (!session) return;

    // Save current answer if selected
    const updatedAnswers = { ...session.answers };
    if (selectedAnswer && currentQuestion) {
      updatedAnswers[currentQuestion.id] = selectedAnswer;
    }

    // Navigate to selected question
    const updatedSession: QuizSession = {
      ...session,
      currentQuestionIndex: questionIndex,
      answers: updatedAnswers
    };

    setSession(updatedSession);
    setCurrentQuestion(session.questions[questionIndex]);
    setSelectedAnswer(updatedAnswers[session.questions[questionIndex].id] || '');
    StorageUtils.saveCurrentSession(updatedSession);
  };

  const handleSubmitQuiz = () => {
    if (!session || !window.confirm('Are you sure you want to submit the quiz? You cannot change your answers after submission.')) {
      return;
    }

    console.log('=== SUBMIT QUIZ DEBUG ===');
    console.log('Session at submit:', session);
    console.log('Session questions count at submit:', session.questions.length);
    console.log('Session answers:', session.answers);
    console.log('=== END SUBMIT DEBUG ===');

    setIsSubmitting(true);

    // Save final answer
    const updatedAnswers = { ...session.answers };
    if (selectedAnswer && currentQuestion) {
      updatedAnswers[currentQuestion.id] = selectedAnswer;
    }

    const completedSession: QuizSession = {
      ...session,
      answers: updatedAnswers,
      isCompleted: true,
      endTime: Date.now()
    };

    console.log('=== COMPLETED SESSION DEBUG ===');
    console.log('Completed session:', completedSession);
    console.log('Completed session questions count:', completedSession.questions.length);
    console.log('Images in completed session:');
    completedSession.questions.forEach((q, index) => {
      if (q.imageUrl) {
        console.log(`  Question ${index + 1}: Has image (${q.imageUrl.substring(0, 50)}...)`);
      }
    });
    console.log('=== END COMPLETED SESSION DEBUG ===');

    StorageUtils.saveSession(completedSession);
    StorageUtils.clearCurrentSession();

    // Navigate to results
    const results = QuizUtils.calculateResults(completedSession);
    console.log('=== CALCULATED RESULTS DEBUG ===');
    console.log('Calculated results:', results);
    console.log('=== END RESULTS DEBUG ===');
    
    sessionStorage.setItem('quiz_results', JSON.stringify(results));
    window.location.href = '/quiz-results';
  };

  if (isLoading) {
    return (
      <Container className="py-5 text-center">
        <div>
          <i className="fas fa-spinner fa-spin fa-3x text-primary mb-3"></i>
          <h4>Loading Quiz...</h4>
        </div>
      </Container>
    );
  }

  if (!session || !currentQuestion) {
    return (
      <Container className="py-5 text-center">
        <div>
          <i className="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
          <h4>Quiz Not Found</h4>
          <Button variant="primary" href="/quiz-categories">
            Back to Categories
          </Button>
        </div>
      </Container>
    );
  }

  const progress = ((session.currentQuestionIndex + 1) / session.questions.length) * 100;
  const answeredCount = Object.keys(session.answers).length;
  const hasAnswer = Boolean(selectedAnswer);

  return (
    <Container className="py-4">
      {/* Timer Display */}
      <Row className="mb-3">
        <Col>
          <Card className={`border-0 bg-${getTimerColor()}`}>
            <Card.Body className="py-2">
              <div className="text-center text-white">
                <h5 className="mb-0">
                  <i className="fas fa-clock me-2"></i>
                  Time Remaining: {formatTime(timeLeft)}
                </h5>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Quiz Header */}
      <Row className="mb-4">
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="fw-bold mb-1">
                    Question {session.currentQuestionIndex + 1} of {session.questions.length}
                  </h5>
                  <small className="text-muted">
                    {answeredCount} answered • {session.questions.length - answeredCount} remaining
                  </small>
                </div>
                <Badge bg="primary" className="fs-6">
                  {Math.round(progress)}%
                </Badge>
              </div>
              <ProgressBar now={progress} className="mb-2" style={{height: '8px'}} />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Question Card */}
      <Row className="mb-4">
        {/* Main Content Column */}
        <Col lg={8}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="p-4">
              {/* Question Header */}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center">
                  <span className="text-muted me-2">Q{(session?.currentQuestionIndex || 0) + 1}</span>
                  <span className="badge bg-success me-2">+4</span>
                  <span className="badge bg-danger">-1</span>
                </div>
                <Badge bg="primary" className="fs-6">
                  Question {(session?.currentQuestionIndex || 0) + 1} of {session?.questions.length || 0}
                </Badge>
              </div>

              <h5 className="mb-4 question-text fw-bold">
                {currentQuestion.question}
              </h5>

              {/* Question Image - Full Width if exists */}
              {currentQuestion.imageUrl && (
                <div className="text-center mb-4">
                  <img
                    src={currentQuestion.imageUrl}
                    alt="Question"
                    className="question-image-full"
                  />
                </div>
              )}

              {/* Answer Options in 2x2 Grid */}
              <Row className="g-3 mb-4">
                {Object.entries(currentQuestion.options).map(([key, option]) => (
                  <Col md={6} key={key}>
                    <Button
                      variant={selectedAnswer === key ? 'primary' : 'outline-secondary'}
                      className={`w-100 text-start p-3 h-auto option-button-grid ${selectedAnswer === key ? 'btn-primary' : ''}`}
                      onClick={() => handleAnswerSelect(key)}
                    >
                      <div className="d-flex align-items-start">
                        <span 
                          className={`badge me-3 fw-bold option-badge ${
                            selectedAnswer === key ? 'option-badge-selected' : 'option-badge-default'
                          }`}
                        >
                          {key.toUpperCase()}
                        </span>
                        <span className="option-text">
                          {option}
                        </span>
                      </div>
                    </Button>
                  </Col>
                ))}
              </Row>

              {/* Navigation Buttons */}
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <Button
                    variant="outline-secondary"
                    className="me-2"
                    onClick={() => setSelectedAnswer('')}
                  >
                    Clear Response
                  </Button>
                  <Button
                    variant="outline-warning"
                    onClick={handleNext}
                  >
                    Mark For Review & Next
                  </Button>
                </div>

                <div className="d-flex gap-2">
                  {session.currentQuestionIndex > 0 && (
                    <Button
                      variant="outline-secondary"
                      onClick={handlePrevious}
                    >
                      Previous
                    </Button>
                  )}

                  {session.currentQuestionIndex < session.questions.length - 1 ? (
                    <Button
                      variant="dark"
                      onClick={handleNext}
                      className="px-4"
                    >
                      Save & Next
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      onClick={handleSubmitQuiz}
                      disabled={isSubmitting}
                      className="px-4"
                    >
                      Submit
                    </Button>
                  )}
                </div>
              </div>

              {!hasAnswer && (
                <div className="text-center mt-3">
                  <small className="text-muted">
                    <i className="fas fa-info-circle me-1"></i>
                    Select an answer to continue, or skip this question
                  </small>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Navigator Column */}
        <Col lg={4}>
          {/* Overview Panel */}
          <Card className="border-0 shadow-sm mb-3">
            <Card.Header className="bg-light">
              <h6 className="mb-0 fw-bold">Overview</h6>
            </Card.Header>
            <Card.Body className="p-3">
              <div className="row text-center">
                <div className="col-6">
                  <div className="d-flex flex-column">
                    <span className="fw-bold text-success fs-4">{answeredCount}</span>
                    <small className="text-muted">Answered</small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="d-flex flex-column">
                    <span className="fw-bold text-danger fs-4">{session.questions.length - answeredCount}</span>
                    <small className="text-muted">Not Answered</small>
                  </div>
                </div>
              </div>
              <hr className="my-2" />
              <div className="text-center">
                <div className="d-flex flex-column">
                  <span className="fw-bold text-primary fs-4">{session.questions.length}</span>
                  <small className="text-muted">Total Questions</small>
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Question Navigator */}
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-primary text-white">
              <h6 className="mb-0">
                <i className="fas fa-th-large me-2"></i>
                Question Navigator
              </h6>
            </Card.Header>
            <Card.Body className="p-3">
              {/* Legend */}
              <div className="d-flex justify-content-around mb-3 text-center">
                <div className="d-flex flex-column align-items-center">
                  <span className="badge bg-success rounded-circle legend-circle"></span>
                  <small className="text-muted mt-1">Answered</small>
                </div>
                <div className="d-flex flex-column align-items-center">
                  <span className="badge bg-danger rounded-circle legend-circle"></span>
                  <small className="text-muted mt-1">Not Answered</small>
                </div>
                <div className="d-flex flex-column align-items-center">
                  <span className="badge bg-warning rounded-circle legend-circle"></span>
                  <small className="text-muted mt-1">Marked for Review</small>
                </div>
              </div>
              
              {/* Question Grid */}
              <div className="navigation-grid mb-3">
                {session.questions.map((question, index) => {
                  const isAnswered = Boolean(session.answers[question.id]);
                  const isCurrent = index === session.currentQuestionIndex;
                  
                  return (
                    <Button
                      key={question.id}
                      variant={isCurrent ? 'primary' : (isAnswered ? 'success' : 'outline-danger')}
                      size="sm"
                      className={`rounded navigator-button ${isCurrent ? 'border-3' : ''}`}
                      onClick={() => handleQuestionNavigation(index)}
                    >
                      {index + 1}
                    </Button>
                  );
                })}
              </div>
              
              {/* Submit Button */}
              <Button
                variant="danger"
                className="w-100"
                onClick={handleSubmitQuiz}
                disabled={isSubmitting}
              >
                <i className="fas fa-paper-plane me-2"></i>
                Submit
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Quiz;
