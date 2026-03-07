import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Modal } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [studentInfo, setStudentInfo] = useState({
    name: '',
    email: '',
    phone: '',
    class: ''
  });
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!passcode.trim()) {
      setError('Please enter a passcode');
      setIsLoading(false);
      return;
    }

    const success = login(passcode);
    
    if (success) {
      // Login successful - AuthContext will handle the redirect
      console.log('Login successful');
    } else {
      setError('Invalid passcode. Please check your passcode and try again.');
    }
    
    setIsLoading(false);
  };

  const handlePasscodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasscode(e.target.value);
    if (error) setError(''); // Clear error when user starts typing
  };

  return (
    <div className="min-vh-100 d-flex align-items-center bg-light">
      <Container>
        <Row className="justify-content-center">
          <Col md={6} lg={4}>
            <Card className="shadow-lg border-0">
              <Card.Header className="bg-primary text-white text-center py-4">
                <div className="mb-3">
                  <i className="fas fa-brain fa-3x"></i>
                </div>
                <h3 className="fw-bold mb-0">Quiz Master</h3>
                <p className="mb-0 opacity-75">Enter your passcode to continue</p>
              </Card.Header>
              
              <Card.Body className="p-4">
                {error && (
                  <Alert variant="danger" className="mb-3">
                    <i className="fas fa-exclamation-circle me-2"></i>
                    {error}
                  </Alert>
                )}

                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-4">
                    <Form.Label className="fw-bold">
                      <i className="fas fa-key me-2"></i>
                      Passcode
                    </Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Enter your passcode"
                      value={passcode}
                      onChange={handlePasscodeChange}
                      disabled={isLoading}
                      className="form-control-lg"
                      autoFocus
                    />
                  </Form.Group>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-100"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <i className="fas fa-spinner fa-spin me-2"></i>
                        Logging in...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-sign-in-alt me-2"></i>
                        Login
                      </>
                    )}
                  </Button>
                </Form>
              </Card.Body>

              <Card.Footer className="bg-light text-center py-3">
                <small className="text-muted">
                  <i className="fas fa-info-circle me-1"></i>
                  Contact your administrator for access
                </small>
              </Card.Footer>
            </Card>
          </Col>
        </Row>

        {/* Instructions */}
        <Row className="justify-content-center mt-4">
          <Col md={8} lg={6}>
            <Card className="border-0 bg-transparent">
              <Card.Body className="text-center">
                <h5 className="text-primary fw-bold mb-3">
                  <i className="fas fa-question-circle me-2"></i>
                  How to Access
                </h5>
                <Row className="g-3">
                  <Col md={6}>
                    <div className="p-3 bg-white rounded shadow-sm">
                      <i className="fas fa-user-graduate fa-2x text-success mb-2"></i>
                      <h6 className="fw-bold text-success">Students</h6>
                      <small className="text-muted">
                        Use the passcode provided by your teacher to access quizzes
                      </small>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="p-3 bg-white rounded shadow-sm">
                      <i className="fas fa-user-tie fa-2x text-primary mb-2"></i>
                      <h6 className="fw-bold text-primary">Admin</h6>
                      <small className="text-muted">
                        Use your admin passcode to manage quizzes and view results
                      </small>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Login;
