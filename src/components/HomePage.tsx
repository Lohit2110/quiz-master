import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      {/* Hero Section */}
      <div className="hero-section bg-primary text-white py-5">
        <Container>
          <Row className="text-center">
            <Col>
              <h1 className="display-4 fw-bold mb-3">
                <i className="fas fa-brain me-3"></i>
                Welcome to Quiz Master
              </h1>
              <p className="lead mb-4">
                The ultimate quiz creation and management platform. Create engaging quizzes, 
                test your knowledge, and track your progress with our comprehensive quiz system.
              </p>
              <div className="d-flex gap-3 justify-content-center flex-wrap">
                <Button variant="light" size="lg" onClick={() => navigate('/quiz-categories')}>
                  <i className="fas fa-play me-2"></i>
                  Take a Quiz
                </Button>
                <Button variant="outline-light" size="lg" onClick={() => navigate('/create-quiz')}>
                  <i className="fas fa-plus-circle me-2"></i>
                  Create Quiz
                </Button>
              </div>
            </Col>
          </Row>
        </Container>
      </div>

      {/* Features Section */}
      <Container className="py-5">
        <Row className="text-center mb-5">
          <Col>
            <h2 className="display-5 fw-bold">Powerful Features</h2>
            <p className="lead text-muted">
              Everything you need to create, manage, and take quizzes
            </p>
          </Col>
        </Row>

        <Row className="g-4">
          <Col lg={4} md={6}>
            <Card className="h-100 shadow-sm border-0">
              <Card.Body className="text-center p-4">
                <div className="feature-icon mb-3">
                  <i className="fas fa-palette fa-3x text-primary"></i>
                </div>
                <h5 className="fw-bold">Dynamic Quiz Builder</h5>
                <p className="text-muted">
                  Create quizzes with multiple question types, image support, 
                  and drag-and-drop functionality. Build comprehensive quizzes in minutes.
                </p>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4} md={6}>
            <Card className="h-100 shadow-sm border-0">
              <Card.Body className="text-center p-4">
                <div className="feature-icon mb-3">
                  <i className="fas fa-images fa-3x text-success"></i>
                </div>
                <h5 className="fw-bold">Advanced Image Support</h5>
                <p className="text-muted">
                  Upload images via file browser, drag-and-drop, or paste from clipboard. 
                  Support for all major image formats with real-time preview.
                </p>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4} md={6}>
            <Card className="h-100 shadow-sm border-0">
              <Card.Body className="text-center p-4">
                <div className="feature-icon mb-3">
                  <i className="fas fa-chart-line fa-3x text-info"></i>
                </div>
                <h5 className="fw-bold">Comprehensive Analytics</h5>
                <p className="text-muted">
                  Track performance with detailed results, progress tracking, 
                  and exportable PDF reports for thorough analysis.
                </p>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4} md={6}>
            <Card className="h-100 shadow-sm border-0">
              <Card.Body className="text-center p-4">
                <div className="feature-icon mb-3">
                  <i className="fas fa-mobile-alt fa-3x text-warning"></i>
                </div>
                <h5 className="fw-bold">Responsive Design</h5>
                <p className="text-muted">
                  Works perfectly on all devices - desktop, tablet, and mobile. 
                  Take quizzes anywhere with our mobile-optimized interface.
                </p>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4} md={6}>
            <Card className="h-100 shadow-sm border-0">
              <Card.Body className="text-center p-4">
                <div className="feature-icon mb-3">
                  <i className="fas fa-cogs fa-3x text-danger"></i>
                </div>
                <h5 className="fw-bold">Admin Dashboard</h5>
                <p className="text-muted">
                  Powerful admin panel for managing questions, categories, 
                  and quiz settings. Full CRUD operations with bulk editing.
                </p>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4} md={6}>
            <Card className="h-100 shadow-sm border-0">
              <Card.Body className="text-center p-4">
                <div className="feature-icon mb-3">
                  <i className="fas fa-random fa-3x text-secondary"></i>
                </div>
                <h5 className="fw-bold">Flexible Quiz Options</h5>
                <p className="text-muted">
                  Custom quiz length, random or sequential questions, 
                  category filtering, and personalized quiz experiences.
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Quick Stats Section */}
      <div className="bg-light py-5">
        <Container>
          <Row className="text-center">
            <Col md={3} sm={6} className="mb-4">
              <div className="stat-item">
                <h3 className="display-6 fw-bold text-primary">∞</h3>
                <p className="text-muted">Unlimited Quizzes</p>
              </div>
            </Col>
            <Col md={3} sm={6} className="mb-4">
              <div className="stat-item">
                <h3 className="display-6 fw-bold text-success">∞</h3>
                <p className="text-muted">Questions per Quiz</p>
              </div>
            </Col>
            <Col md={3} sm={6} className="mb-4">
              <div className="stat-item">
                <h3 className="display-6 fw-bold text-info">100%</h3>
                <p className="text-muted">Mobile Responsive</p>
              </div>
            </Col>
            <Col md={3} sm={6} className="mb-4">
              <div className="stat-item">
                <h3 className="display-6 fw-bold text-warning">24/7</h3>
                <p className="text-muted">Available Access</p>
              </div>
            </Col>
          </Row>
        </Container>
      </div>

      {/* Call to Action Section */}
      <Container className="py-5">
        <Row className="text-center">
          <Col>
            <h2 className="display-5 fw-bold mb-3">Ready to Get Started?</h2>
            <p className="lead text-muted mb-4">
              Join thousands of users who are already creating and taking amazing quizzes!
            </p>
            <div className="d-flex gap-3 justify-content-center flex-wrap">
              <Button variant="primary" size="lg" onClick={() => navigate('/create-quiz')}>
                <i className="fas fa-rocket me-2"></i>
                Create Your First Quiz
              </Button>
              <Button variant="outline-primary" size="lg" onClick={() => navigate('/quiz-categories')}>
                <i className="fas fa-eye me-2"></i>
                Explore Categories
              </Button>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default HomePage;
