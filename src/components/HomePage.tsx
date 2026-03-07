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
              {/* Animated Brain Icon */}
              <div className="hero-icon">
                <i className="fas fa-brain"></i>
              </div>
              <h1 className="display-4 fw-bold mb-3">
                Welcome to Quiz Master
              </h1>
              <p className="lead mb-3">
                The ultimate quiz creation and management platform. Create engaging quizzes, 
                test your knowledge, and track your progress with our comprehensive quiz system.
              </p>
              <p className="hero-tagline mb-4">
                "Create quizzes in minutes. Practice smarter, not harder."
              </p>
              <div className="d-flex gap-3 justify-content-center flex-wrap">
                <Button 
                  variant="light" 
                  size="lg" 
                  className="btn-pill px-4"
                  onClick={() => navigate('/quiz-categories')}
                >
                  <i className="fas fa-play me-2"></i>
                  Take a Quiz
                </Button>
                <Button 
                  variant="outline-light" 
                  size="lg" 
                  className="btn-pill px-4"
                  onClick={() => navigate('/create-quiz')}
                >
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
            <h2 className="section-title">Powerful Features</h2>
            <p className="section-subtitle">
              Everything you need to create, manage, and take quizzes
            </p>
          </Col>
        </Row>

        <Row className="g-4">
          <Col lg={4} md={6}>
            <Card className="feature-card h-100 border-0">
              <Card.Body className="text-center p-4">
                <div className="feature-icon primary">
                  <i className="fas fa-palette"></i>
                </div>
                <h5 className="feature-title">Dynamic Quiz Builder</h5>
                <p className="feature-description">
                  Create quizzes with multiple question types, image support, 
                  and drag-and-drop functionality. Build comprehensive quizzes in minutes.
                </p>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4} md={6}>
            <Card className="feature-card h-100 border-0">
              <Card.Body className="text-center p-4">
                <div className="feature-icon success">
                  <i className="fas fa-images"></i>
                </div>
                <h5 className="feature-title">Advanced Image Support</h5>
                <p className="feature-description">
                  Upload images via file browser, drag-and-drop, or paste from clipboard. 
                  Support for all major image formats with real-time preview.
                </p>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4} md={6}>
            <Card className="feature-card h-100 border-0">
              <Card.Body className="text-center p-4">
                <div className="feature-icon info">
                  <i className="fas fa-chart-line"></i>
                </div>
                <h5 className="feature-title">Comprehensive Analytics</h5>
                <p className="feature-description">
                  Track performance with detailed results, progress tracking, 
                  and exportable PDF reports for thorough analysis.
                </p>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4} md={6}>
            <Card className="feature-card h-100 border-0">
              <Card.Body className="text-center p-4">
                <div className="feature-icon warning">
                  <i className="fas fa-mobile-alt"></i>
                </div>
                <h5 className="feature-title">Responsive Design</h5>
                <p className="feature-description">
                  Works perfectly on all devices - desktop, tablet, and mobile. 
                  Take quizzes anywhere with our mobile-optimized interface.
                </p>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4} md={6}>
            <Card className="feature-card h-100 border-0">
              <Card.Body className="text-center p-4">
                <div className="feature-icon danger">
                  <i className="fas fa-cogs"></i>
                </div>
                <h5 className="feature-title">Admin Dashboard</h5>
                <p className="feature-description">
                  Powerful admin panel for managing questions, categories, 
                  and quiz settings. Full CRUD operations with bulk editing.
                </p>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4} md={6}>
            <Card className="feature-card h-100 border-0">
              <Card.Body className="text-center p-4">
                <div className="feature-icon primary">
                  <i className="fas fa-random"></i>
                </div>
                <h5 className="feature-title">Flexible Quiz Options</h5>
                <p className="feature-description">
                  Custom quiz length, random or sequential questions, 
                  category filtering, and personalized quiz experiences.
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Quick Stats Section */}
      <div className="stats-section py-5">
        <Container>
          <Row className="text-center">
            <Col md={3} sm={6} className="mb-4">
              <div className="stat-card">
                <div className="stat-number">∞</div>
                <p className="stat-label">Unlimited Quizzes</p>
              </div>
            </Col>
            <Col md={3} sm={6} className="mb-4">
              <div className="stat-card">
                <div className="stat-number">∞</div>
                <p className="stat-label">Questions per Quiz</p>
              </div>
            </Col>
            <Col md={3} sm={6} className="mb-4">
              <div className="stat-card">
                <div className="stat-number">100%</div>
                <p className="stat-label">Mobile Responsive</p>
              </div>
            </Col>
            <Col md={3} sm={6} className="mb-4">
              <div className="stat-card">
                <div className="stat-number">24/7</div>
                <p className="stat-label">Available Access</p>
              </div>
            </Col>
          </Row>
        </Container>
      </div>

      {/* Call to Action Section */}
      <Container className="py-5">
        <Row className="text-center">
          <Col>
            <h2 className="section-title mb-3">Ready to Get Started?</h2>
            <p className="section-subtitle mb-4">
              Join thousands of users who are already creating and taking amazing quizzes!
            </p>
            <div className="d-flex gap-3 justify-content-center flex-wrap">
              <Button 
                variant="primary" 
                size="lg" 
                className="btn-pill px-4"
                onClick={() => navigate('/create-quiz')}
              >
                <i className="fas fa-rocket me-2"></i>
                Create Your First Quiz
              </Button>
              <Button 
                variant="outline-primary" 
                size="lg" 
                className="btn-pill px-4"
                onClick={() => navigate('/quiz-categories')}
              >
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
