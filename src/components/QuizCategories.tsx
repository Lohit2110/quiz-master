import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { QuizCategory, SavedQuiz, StudentInfo } from '../types';
import { StorageUtils, QuizUtils } from '../utils/storage';
import QuizStartCountdown from './QuizStartCountdown';
import StudentInfoModal from './StudentInfoModal';
import { cloudSync } from '../services/CloudSyncService';
import { localFileSystem } from '../services/LocalFileSystemService';
import { realTimeQuizService } from '../services/RealTimeQuizService';
import { useAuth } from '../contexts/AuthContext';
import { useQuizContext } from '../contexts/QuizContext';

const QuizCategories: React.FC = () => {
  const navigate = useNavigate();
  const { isStudent, isTeacher, getActiveStudentsCount } = useAuth();
  const { quizzes: savedQuizzes, refreshQuizzes } = useQuizContext();
  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [numberOfQuestions, setNumberOfQuestions] = useState<number>(5);
  const [selectionMode, setSelectionMode] = useState<'random' | 'sequential'>('random');
  const [timerMinutes, setTimerMinutes] = useState<number>(10); // Default 10 minutes
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [newQuizAlert, setNewQuizAlert] = useState<boolean>(false);

  // Confirmation modal state
  const [showStudentInfo, setShowStudentInfo] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [pendingQuizStart, setPendingQuizStart] = useState<{
    type: 'category' | 'saved';
    id: string;
    customSettings?: boolean;
    customTimer?: boolean;
    title: string;
    questionCount: number;
    timeLimit?: number;
  } | null>(null);

  useEffect(() => {
    StorageUtils.safeInitialize();
    loadCategories();

    // QuizContext handles Firebase real-time sync automatically
    console.log('👤 User logged in - QuizContext managing Firebase sync');

    // Trigger initial refresh from QuizContext
    refreshQuizzes().catch((error) => {
      console.error('Initial quiz refresh failed:', error);
    });
  }, [isStudent]);

  const loadCategories = () => {
    const cats = StorageUtils.getCategories();
    setCategories(cats);
  };

  // Sync from cloud - QuizContext handles the heavy lifting
  const syncFromCloud = async () => {
    try {
      console.log('🔄 Starting sync process...');
      setSyncStatus('syncing');

      // Use QuizContext to refresh from Firebase
      await refreshQuizzes();

      console.log(`✅ Sync successful: ${savedQuizzes.length} quizzes`);
      setSyncStatus('success');
      setLastSyncTime(new Date());
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error) {
      console.error('❌ Error syncing:', error);
      try {
        if (savedQuizzes.length > 0) {
          console.log(`📦 Using ${savedQuizzes.length} quizzes from context as fallback`);
          setSyncStatus('success');
        } else {
          setSyncStatus('error');
        }
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        setSyncStatus('error');
      }
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  // Manual refresh for students
  const handleManualRefresh = () => {
    syncFromCloud();
  };

  const checkForUnmatchedQuestions = () => {
    const questions = StorageUtils.getQuestions();
    const predefinedCategories = ['general-knowledge', 'science', 'history', 'sports'];
    return questions.filter(q => !predefinedCategories.includes(q.category));
  };

  const convertUnmatchedQuestions = () => {
    const unmatchedQuestions = checkForUnmatchedQuestions();
    if (unmatchedQuestions.length > 0) {
      const newQuiz: SavedQuiz = {
        id: QuizUtils.generateId(),
        title: 'Converted Quiz',
        questions: unmatchedQuestions,
        createdAt: Date.now(),
        description: `Quiz converted from ${unmatchedQuestions.length} unmatched questions`
      };

      StorageUtils.addSavedQuiz(newQuiz);

      // Remove converted questions from individual storage
      const questions = StorageUtils.getQuestions();
      const predefinedCategories = ['general-knowledge', 'science', 'history', 'sports'];
      const remainingQuestions = questions.filter(q => predefinedCategories.includes(q.category));
      StorageUtils.saveQuestions(remainingQuestions);

      // Refresh quizzes from Firebase/Context
      refreshQuizzes().catch((error) => console.error('Failed to refresh quizzes:', error));
      alert(`Converted ${unmatchedQuestions.length} questions to a saved quiz!`);
    }
  };

  const handleStartQuiz = (categoryId: string, customSettings?: boolean) => {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    const questionCount = customSettings ? numberOfQuestions : category.questionCount;
    const timeLimit = customSettings ? timerMinutes : 10;

    // Show student info modal first
    setPendingQuizStart({
      type: 'category',
      id: categoryId,
      customSettings,
      title: category.name,
      questionCount,
      timeLimit
    });
    setShowStudentInfo(true);
  };

  const handleStartSavedQuiz = (quizId: string, customTimer?: boolean) => {
    // Get the saved quiz to check for default timer
    const savedQuiz = savedQuizzes.find(quiz => quiz.id === quizId);
    if (!savedQuiz) return;

    const defaultTimer = savedQuiz.defaultTimerMinutes || 10;
    const timeLimit = customTimer ? timerMinutes : defaultTimer;

    // Show student info modal first
    setPendingQuizStart({
      type: 'saved',
      id: quizId,
      customTimer,
      title: savedQuiz.title,
      questionCount: savedQuiz.questions.length,
      timeLimit
    });
    setShowStudentInfo(true);
  };

  const handleStudentInfoSubmit = (info: StudentInfo) => {
    setStudentInfo(info);
    setShowStudentInfo(false);
    setShowCountdown(true);
  };

  const handleStudentInfoCancel = () => {
    setShowStudentInfo(false);
    setPendingQuizStart(null);
    setStudentInfo(null);
  };

  const handleCountdownConfirm = () => {
    if (!pendingQuizStart || !studentInfo) return;

    // Store student info in session storage for the quiz
    sessionStorage.setItem('current_student_info', JSON.stringify(studentInfo));

    if (pendingQuizStart.type === 'category') {
      // Navigate to category quiz
      const params = new URLSearchParams({
        category: pendingQuizStart.id,
        questions: pendingQuizStart.questionCount.toString(),
        timer: pendingQuizStart.timeLimit!.toString(),
        mode: selectionMode
      });
      navigate(`/quiz?${params.toString()}`);
    } else {
      // Navigate to saved quiz
      const params = new URLSearchParams({
        savedQuiz: pendingQuizStart.id,
        timer: pendingQuizStart.timeLimit!.toString()
      });
      navigate(`/quiz?${params.toString()}`);
    }

    setShowCountdown(false);
    setPendingQuizStart(null);
    setStudentInfo(null);
  };

  const handleCountdownCancel = () => {
    setShowCountdown(false);
    setPendingQuizStart(null);
    setStudentInfo(null);
  };

  const getQuestionCountForCategory = (categoryId: string): number => {
    const questions = StorageUtils.getQuestionsByCategory(categoryId);
    return questions.length;
  };

  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <h1 className="display-5 fw-bold text-center">
            <i className="fas fa-list-alt me-3"></i>
            Choose a Quiz Category
          </h1>
          <p className="lead text-center text-muted">
            Select a category and customize your quiz experience
          </p>
        </Col>
      </Row>

      {/* Unmatched Questions Section */}
      {checkForUnmatchedQuestions().length > 0 && (
        <Row className="mb-4">
          <Col>
            <Card className="border-warning bg-light">
              <Card.Body>
                <h5 className="text-warning">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  Found {checkForUnmatchedQuestions().length} Unmatched Questions
                </h5>
                <p className="mb-3">
                  We found questions that were created with the old system.
                  Would you like to convert them to a saved quiz?
                </p>
                <Button
                  variant="warning"
                  onClick={convertUnmatchedQuestions}
                  className="me-2"
                >
                  <i className="fas fa-magic me-2"></i>
                  Convert to Saved Quiz
                </Button>
                <small className="text-muted d-block mt-2">
                  This will create a new quiz from your previously created questions.
                </small>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* No Quizzes Message for Students on Mobile */}
      {isStudent && savedQuizzes.length === 0 && (
        <Row className="mb-4">
          <Col>
            <Alert variant="info" className="text-center">
              <i className="fas fa-info-circle fa-2x mb-3"></i>
              <h5 className="fw-bold">No Quizzes Available Yet</h5>
              <p className="mb-3">
                Your teacher hasn't published any quizzes yet, or they may not have synced to your device.
              </p>
              <Button
                variant="primary"
                onClick={handleManualRefresh}
                disabled={syncStatus === 'syncing'}
                size="lg"
              >
                {syncStatus === 'syncing' ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    Checking for Quizzes...
                  </>
                ) : (
                  <>
                    <i className="fas fa-sync-alt me-2"></i>
                    Check for Available Quizzes
                  </>
                )}
              </Button>
              <div className="mt-3">
                <small className="text-muted">
                  <i className="fas fa-lightbulb me-1"></i>
                  Tip: Make sure you're connected to the internet and your teacher has published quizzes.
                </small>
              </div>
            </Alert>
          </Col>
        </Row>
      )}

      {/* Saved Quizzes Section */}
      {savedQuizzes.length > 0 && (
        <>
          <Row className="mb-4">
            <Col>
              <div className="d-flex justify-content-between align-items-center flex-wrap">
                <div className="mb-2 mb-md-0">
                  <h3 className="fw-bold text-primary">
                    <i className="fas fa-bookmark me-2"></i>
                    Your Saved Quizzes ({savedQuizzes.length})
                  </h3>
                  <p className="text-muted mb-0">Take your custom created quizzes</p>
                </div>

                {/* Sync Status for Students */}
                {isStudent && (
                  <div className="d-flex align-items-center gap-3">
                    {syncStatus === 'syncing' && (
                      <div className="text-primary">
                        <Spinner size="sm" className="me-2" />
                        Syncing...
                      </div>
                    )}
                    {syncStatus === 'success' && (
                      <small className="text-success">
                        <i className="fas fa-check-circle me-1"></i>
                        Last synced: {lastSyncTime?.toLocaleTimeString()}
                      </small>
                    )}
                    {syncStatus === 'error' && (
                      <small className="text-danger">
                        <i className="fas fa-exclamation-triangle me-1"></i>
                        Sync failed
                      </small>
                    )}
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={handleManualRefresh}
                      disabled={syncStatus === 'syncing'}
                    >
                      <i className="fas fa-sync-alt me-1"></i>
                      Refresh
                    </Button>
                  </div>
                )}
              </div>
            </Col>
          </Row>

          {/* Auto-sync notification for students */}
          {isStudent && syncStatus === 'success' && (
            <Row className="mb-3">
              <Col>
                <Alert variant="success" className="py-2">
                  <i className="fas fa-cloud-download-alt me-2"></i>
                  <strong>Quizzes Updated!</strong> You now have access to the latest quizzes from your teacher.
                </Alert>
              </Col>
            </Row>
          )}

          <Row className="g-4 mb-5">
            {savedQuizzes.map((quiz) => (
              <Col lg={6} key={quiz.id}>
                <Card className="h-100 shadow-sm border-0 quiz-category-card">
                  <Card.Body className="d-flex flex-column">
                    <div className="mb-3">
                      <h5 className="fw-bold text-success">
                        <i className="fas fa-clipboard-check me-2"></i>
                        {quiz.title}
                      </h5>
                      <p className="text-muted mb-2">{quiz.description}</p>
                      <small className="text-secondary">
                        <i className="fas fa-question-circle me-1"></i>
                        {quiz.questions.length} questions
                      </small>
                      <br />
                      <small className="text-secondary">
                        <i className="fas fa-clock me-1"></i>
                        Default timer: {quiz.defaultTimerMinutes || 10} minutes
                      </small>
                      <br />
                      <small className="text-secondary">
                        <i className="fas fa-calendar me-1"></i>
                        Created: {new Date(quiz.createdAt).toLocaleDateString()}
                      </small>
                      {quiz.subject && (
                        <>
                          <br />
                          <small className="text-secondary">
                            <i className="fas fa-book me-1"></i>
                            Subject: <strong>{quiz.subject}</strong>
                          </small>
                        </>
                      )}
                      {quiz.chapters && quiz.chapters.length > 0 && (
                        <div className="mt-2">
                          <small className="text-secondary d-block mb-1">
                            <i className="fas fa-bookmark me-1"></i>
                            Chapters:
                          </small>
                          <div className="d-flex flex-wrap gap-1">
                            {quiz.chapters.map((ch, idx) => (
                              <span
                                key={idx}
                                className="badge"
                                style={{ backgroundColor: '#e8f4fd', color: '#0d6efd', fontSize: '0.72rem', fontWeight: 500 }}
                              >
                                {ch}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto">
                      <div className="d-flex gap-2 mb-3">
                        <Button
                          variant="success"
                          onClick={() => handleStartSavedQuiz(quiz.id, false)}
                          className={isTeacher ? "flex-fill" : "w-100"}
                        >
                          <i className="fas fa-play me-2"></i>
                          Take Quiz ({quiz.defaultTimerMinutes || 10}min)
                        </Button>
                        {/* Settings button - Admin only */}
                        {isTeacher && (
                          <Button
                            variant="outline-success"
                            onClick={() => setSelectedCategory(
                              selectedCategory === `saved-${quiz.id}` ? '' : `saved-${quiz.id}`
                            )}
                          >
                            <i className="fas fa-cog"></i>
                          </Button>
                        )}
                      </div>

                      {/* Custom Timer Settings for Saved Quiz - ADMIN ONLY */}
                      {selectedCategory === `saved-${quiz.id}` && isTeacher && (
                        <Card className="bg-light border-0">
                          <Card.Body className="p-3">
                            <h6 className="fw-bold mb-3">
                              <i className="fas fa-clock me-2"></i>
                              Timer Settings (Admin Only)
                            </h6>

                            <Form>
                              <Form.Group className="mb-3">
                                <Form.Label className="small fw-bold">
                                  <i className="fas fa-clock me-1"></i>
                                  Timer Duration (Minutes)
                                </Form.Label>
                                <Form.Control
                                  type="number"
                                  min="1"
                                  max="120"
                                  value={timerMinutes}
                                  onChange={(e) => setTimerMinutes(
                                    Math.min(Math.max(parseInt(e.target.value) || 10, 1), 120)
                                  )}
                                  size="sm"
                                />
                                <Form.Text className="text-muted">
                                  Set timer between 1-120 minutes
                                </Form.Text>
                              </Form.Group>

                              <Button
                                variant="success"
                                size="sm"
                                className="w-100"
                                onClick={() => handleStartSavedQuiz(quiz.id, true)}
                              >
                                <i className="fas fa-rocket me-2"></i>
                                Start Quiz with {timerMinutes}min Timer
                              </Button>
                            </Form>
                          </Card.Body>
                        </Card>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </>
      )}

      {/* Categories Section */}
      <Row className="mb-4">
        <Col>
          <h3 className="fw-bold text-primary">
            <i className="fas fa-list-alt me-2"></i>
            Quiz Categories
          </h3>
          <p className="text-muted">Select from predefined quiz categories</p>
        </Col>
      </Row>

      <Row className="g-4">
        {categories.map((category) => {
          const questionCount = getQuestionCountForCategory(category.id);
          return (
            <Col lg={6} key={category.id}>
              <Card className="h-100 shadow-sm border-0 quiz-category-card">
                <Card.Body className="d-flex flex-column">
                  <div className="mb-3">
                    <h5 className="fw-bold text-primary">
                      <i className="fas fa-folder me-2"></i>
                      {category.name}
                    </h5>
                    <p className="text-muted mb-2">{category.description}</p>
                    <small className="text-secondary">
                      <i className="fas fa-question-circle me-1"></i>
                      {questionCount} questions available
                    </small>
                  </div>

                  {questionCount > 0 ? (
                    <div className="mt-auto">
                      <div className="d-flex gap-2 mb-3">
                        <Button
                          variant="primary"
                          onClick={() => handleStartQuiz(category.id, false)}
                          className={isTeacher ? "flex-fill" : "w-100"}
                        >
                          <i className="fas fa-play me-2"></i>
                          Start Full Quiz
                        </Button>
                        {/* Settings button - Admin only */}
                        {isTeacher && (
                          <Button
                            variant="outline-primary"
                            onClick={() => setSelectedCategory(
                              selectedCategory === category.id ? '' : category.id
                            )}
                          >
                            <i className="fas fa-cog"></i>
                          </Button>
                        )}
                      </div>

                      {/* Custom Quiz Settings - ADMIN ONLY */}
                      {selectedCategory === category.id && isTeacher && (
                        <Card className="bg-light border-0">
                          <Card.Body className="p-3">
                            <h6 className="fw-bold mb-3">
                              <i className="fas fa-sliders-h me-2"></i>
                              Custom Quiz Settings (Admin Only)
                            </h6>

                            <Form>
                              <Row className="g-3">
                                <Col sm={4}>
                                  <Form.Group>
                                    <Form.Label className="small fw-bold">
                                      Number of Questions
                                    </Form.Label>
                                    <Form.Control
                                      type="number"
                                      min="1"
                                      max={questionCount}
                                      value={numberOfQuestions}
                                      onChange={(e) => setNumberOfQuestions(
                                        Math.min(parseInt(e.target.value) || 1, questionCount)
                                      )}
                                      size="sm"
                                    />
                                  </Form.Group>
                                </Col>

                                <Col sm={4}>
                                  <Form.Group>
                                    <Form.Label className="small fw-bold">
                                      Selection Mode
                                    </Form.Label>
                                    <Form.Select
                                      value={selectionMode}
                                      onChange={(e) => setSelectionMode(
                                        e.target.value as 'random' | 'sequential'
                                      )}
                                      size="sm"
                                    >
                                      <option value="random">Random</option>
                                      <option value="sequential">Sequential</option>
                                    </Form.Select>
                                  </Form.Group>
                                </Col>

                                <Col sm={4}>
                                  <Form.Group>
                                    <Form.Label className="small fw-bold">
                                      <i className="fas fa-clock me-1"></i>
                                      Timer (Minutes)
                                    </Form.Label>
                                    <Form.Control
                                      type="number"
                                      min="1"
                                      max="120"
                                      value={timerMinutes}
                                      onChange={(e) => setTimerMinutes(
                                        Math.min(Math.max(parseInt(e.target.value) || 10, 1), 120)
                                      )}
                                      size="sm"
                                    />
                                    <Form.Text className="text-muted">
                                      1-120 minutes
                                    </Form.Text>
                                  </Form.Group>
                                </Col>
                              </Row>

                              <Button
                                variant="success"
                                size="sm"
                                className="w-100 mt-3"
                                onClick={() => handleStartQuiz(category.id, true)}
                              >
                                <i className="fas fa-rocket me-2"></i>
                                Start Custom Quiz ({numberOfQuestions} questions, {timerMinutes}min timer)
                              </Button>
                            </Form>
                          </Card.Body>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <div className="mt-auto text-center">
                      <p className="text-muted mb-3">
                        <i className="fas fa-exclamation-circle me-2"></i>
                        No questions available in this category
                      </p>
                      <Button variant="outline-secondary" disabled>
                        Quiz Unavailable
                      </Button>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>

      {categories.length === 0 && (
        <Row className="text-center py-5">
          <Col>
            <div className="text-muted">
              <i className="fas fa-folder-open fa-3x mb-3"></i>
              <h4>No Categories Available</h4>
              <p>Create some quiz categories to get started!</p>
              {isTeacher && (
                <Button variant="primary" href="/admin">
                  <i className="fas fa-plus me-2"></i>
                  Go to Admin Panel
                </Button>
              )}
            </div>
          </Col>
        </Row>
      )}

      {/* Quick Stats */}
      <Row className="mt-5 pt-4 border-top">
        <Col className="text-center">
          <h5 className="fw-bold text-secondary mb-3">Quiz Statistics</h5>
          <Row>
            <Col md={4}>
              <div className="stat-item">
                <h6 className="fw-bold text-primary">{categories.length}</h6>
                <small className="text-muted">Categories</small>
              </div>
            </Col>
            <Col md={4}>
              <div className="stat-item">
                <h6 className="fw-bold text-success">
                  {categories.reduce((total, cat) =>
                    total + getQuestionCountForCategory(cat.id), 0
                  )}
                </h6>
                <small className="text-muted">Total Questions</small>
              </div>
            </Col>
            <Col md={4}>
              <div className="stat-item">
                <h6 className="fw-bold text-info">
                  {categories.filter(cat =>
                    getQuestionCountForCategory(cat.id) > 0
                  ).length}
                </h6>
                <small className="text-muted">Active Categories</small>
              </div>
            </Col>
          </Row>
        </Col>
      </Row>

      {/* Student Info Modal */}
      <StudentInfoModal
        show={showStudentInfo}
        onSubmit={handleStudentInfoSubmit}
        onCancel={handleStudentInfoCancel}
      />

      {/* Quiz Start Countdown Modal */}
      <QuizStartCountdown
        show={showCountdown}
        quizTitle={pendingQuizStart?.title || ''}
        questionCount={pendingQuizStart?.questionCount || 0}
        studentInfo={studentInfo}
        onConfirm={handleCountdownConfirm}
        onCancel={handleCountdownCancel}
      />
    </Container>
  );
};

export default QuizCategories;
