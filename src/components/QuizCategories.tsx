import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form } from 'react-bootstrap';
import { QuizCategory, SavedQuiz } from '../types';
import { StorageUtils, QuizUtils } from '../utils/storage';

const QuizCategories: React.FC = () => {
  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuiz[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [numberOfQuestions, setNumberOfQuestions] = useState<number>(5);
  const [selectionMode, setSelectionMode] = useState<'random' | 'sequential'>('random');
  const [timerMinutes, setTimerMinutes] = useState<number>(10); // Default 10 minutes

  useEffect(() => {
    StorageUtils.safeInitialize();
    loadCategories();
    loadSavedQuizzes();
  }, []);

  const loadCategories = () => {
    const cats = StorageUtils.getCategories();
    setCategories(cats);
  };

  const loadSavedQuizzes = () => {
    const quizzes = StorageUtils.getSavedQuizzes();
    setSavedQuizzes(quizzes);
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
      
      loadSavedQuizzes(); // Reload to show the new quiz
      alert(`Converted ${unmatchedQuestions.length} questions to a saved quiz!`);
    }
  };

  const handleStartQuiz = (categoryId: string, customSettings?: boolean) => {
    if (customSettings) {
      // Navigate to quiz with custom settings
      const params = new URLSearchParams({
        category: categoryId,
        questions: numberOfQuestions.toString(),
        mode: selectionMode,
        timer: timerMinutes.toString()
      });
      window.location.href = `/quiz?${params.toString()}`;
    } else {
      // Start full quiz with default timer
      const params = new URLSearchParams({
        category: categoryId,
        mode: 'random',
        timer: timerMinutes.toString()
      });
      window.location.href = `/quiz?${params.toString()}`;
    }
  };

  const handleStartSavedQuiz = (quizId: string, customTimer?: boolean) => {
    // Navigate to quiz with saved quiz ID
    const params = new URLSearchParams({
      savedQuiz: quizId,
      timer: customTimer ? timerMinutes.toString() : '10' // Default 10 minutes for saved quizzes
    });
    window.location.href = `/quiz?${params.toString()}`;
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

      {/* Saved Quizzes Section */}
      {savedQuizzes.length > 0 && (
        <>
          <Row className="mb-4">
            <Col>
              <h3 className="fw-bold text-primary">
                <i className="fas fa-bookmark me-2"></i>
                Your Saved Quizzes
              </h3>
              <p className="text-muted">Take your custom created quizzes</p>
            </Col>
          </Row>

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
                        <i className="fas fa-calendar me-1"></i>
                        Created: {new Date(quiz.createdAt).toLocaleDateString()}
                      </small>
                    </div>

                    <div className="mt-auto">
                      <div className="d-flex gap-2 mb-3">
                        <Button
                          variant="success"
                          onClick={() => handleStartSavedQuiz(quiz.id, false)}
                          className="flex-fill"
                        >
                          <i className="fas fa-play me-2"></i>
                          Take Quiz (10min)
                        </Button>
                        <Button
                          variant="outline-success"
                          onClick={() => setSelectedCategory(
                            selectedCategory === `saved-${quiz.id}` ? '' : `saved-${quiz.id}`
                          )}
                        >
                          <i className="fas fa-cog"></i>
                        </Button>
                      </div>

                      {/* Custom Timer Settings for Saved Quiz */}
                      {selectedCategory === `saved-${quiz.id}` && (
                        <Card className="bg-light border-0">
                          <Card.Body className="p-3">
                            <h6 className="fw-bold mb-3">
                              <i className="fas fa-clock me-2"></i>
                              Timer Settings
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
                          className="flex-fill"
                        >
                          <i className="fas fa-play me-2"></i>
                          Start Full Quiz
                        </Button>
                        <Button
                          variant="outline-primary"
                          onClick={() => setSelectedCategory(
                            selectedCategory === category.id ? '' : category.id
                          )}
                        >
                          <i className="fas fa-cog"></i>
                        </Button>
                      </div>

                      {/* Custom Quiz Settings */}
                      {selectedCategory === category.id && (
                        <Card className="bg-light border-0">
                          <Card.Body className="p-3">
                            <h6 className="fw-bold mb-3">
                              <i className="fas fa-sliders-h me-2"></i>
                              Custom Quiz Settings
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
              <Button variant="primary" href="/admin">
                <i className="fas fa-plus me-2"></i>
                Go to Admin Panel
              </Button>
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
    </Container>
  );
};

export default QuizCategories;
