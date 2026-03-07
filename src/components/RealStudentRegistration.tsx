import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Tabs, Tab } from 'react-bootstrap';
import { realOTPService } from '../services/RealOTPService';

interface RealStudentRegistrationProps {
  onRegistrationSuccess: () => void;
  onSwitchToLogin: () => void;
}

const RealStudentRegistration: React.FC<RealStudentRegistrationProps> = ({ 
  onRegistrationSuccess, 
  onSwitchToLogin 
}) => {
  const [registrationType, setRegistrationType] = useState<'mobile' | 'email'>('mobile');
  const [formData, setFormData] = useState({
    mobile: '',
    email: '',
    name: '',
    className: '',
  });
  const [errors, setErrors] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear specific field error when user starts typing
    if (errors[field]) {
      setErrors((prev: any) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: any = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    // Mobile or Email validation based on type
    if (registrationType === 'mobile') {
      const cleanMobile = formData.mobile.replace(/\D/g, '');
      if (!cleanMobile) {
        newErrors.mobile = 'Mobile number is required';
      } else if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
        newErrors.mobile = 'Please enter a valid 10-digit mobile number';
      }
    } else {
      if (!formData.email.trim()) {
        newErrors.email = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setSuccessMessage('');
    setErrors({});

    let result;

    if (registrationType === 'mobile') {
      // Register with mobile number
      result = realOTPService.registerWithMobile(
        formData.mobile,
        formData.name.trim(),
        formData.className.trim() || undefined
      );
    } else {
      // Register with email
      result = realOTPService.registerWithEmail(
        formData.email,
        formData.name.trim(),
        formData.className.trim() || undefined
      );
    }

    setIsLoading(false);

    if (result.success) {
      setSuccessMessage(result.message);
      // Clear form
      setFormData({
        mobile: '',
        email: '',
        name: '',
        className: '',
      });
      // Redirect to login after 2 seconds
      setTimeout(() => {
        onRegistrationSuccess();
      }, 2000);
    } else {
      setErrors({ submit: result.message });
    }
  };

  return (
    <Container className="min-vh-100 d-flex align-items-center py-5">
      <Row className="w-100 justify-content-center">
        <Col md={7} lg={6}>
          <Card className="shadow-lg border-0">
            <Card.Header className="bg-success text-white text-center py-4">
              <h2 className="fw-bold mb-1">
                <i className="fas fa-user-plus me-2"></i>
                Student Registration
              </h2>
              <p className="mb-0 opacity-75">Create your account to access quizzes</p>
            </Card.Header>

            <Card.Body className="p-4">
              {errors.submit && (
                <Alert variant="danger" dismissible onClose={() => setErrors({})}>
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  {errors.submit}
                </Alert>
              )}

              {successMessage && (
                <Alert variant="success">
                  <i className="fas fa-check-circle me-2"></i>
                  {successMessage}
                  <div className="mt-2 small">
                    <i className="fas fa-spinner fa-spin me-1"></i>
                    Redirecting to login...
                  </div>
                </Alert>
              )}

              {/* Registration Type Selection */}
              <Tabs
                activeKey={registrationType}
                onSelect={(k) => {
                  setRegistrationType(k as 'mobile' | 'email');
                  setFormData({
                    mobile: '',
                    email: '',
                    name: formData.name,
                    className: formData.className,
                  });
                  setErrors({});
                }}
                className="mb-4 nav-fill"
                variant="pills"
              >
                <Tab 
                  eventKey="mobile" 
                  title={<><i className="fas fa-mobile-alt me-2"></i>Mobile Number</>}
                >
                  <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3 mt-4">
                      <Form.Label className="fw-semibold">
                        <i className="fas fa-user me-2"></i>
                        Full Name <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        size="lg"
                        placeholder="Enter your full name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        isInvalid={!!errors.name}
                        required
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.name}
                      </Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold">
                        <i className="fas fa-phone me-2"></i>
                        Mobile Number <span className="text-danger">*</span>
                      </Form.Label>
                      <div className="input-group input-group-lg">
                        <span className="input-group-text bg-light">
                          <i className="fas fa-flag me-1"></i>+91
                        </span>
                        <Form.Control
                          type="tel"
                          placeholder="Enter 10-digit mobile number"
                          value={formData.mobile}
                          onChange={(e) => handleInputChange('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                          isInvalid={!!errors.mobile}
                          maxLength={10}
                          style={{ fontSize: '1.1rem', letterSpacing: '0.1rem' }}
                          required
                        />
                        <Form.Control.Feedback type="invalid">
                          {errors.mobile}
                        </Form.Control.Feedback>
                      </div>
                      <Form.Text className="text-muted">
                        <i className="fas fa-info-circle me-1"></i>
                        You'll receive OTP on this number for login
                      </Form.Text>
                    </Form.Group>

                    <Form.Group className="mb-4">
                      <Form.Label className="fw-semibold">
                        <i className="fas fa-school me-2"></i>
                        Class/Grade (Optional)
                      </Form.Label>
                      <Form.Control
                        type="text"
                        size="lg"
                        placeholder="e.g., Class 10, Grade 12, JEE 2025"
                        value={formData.className}
                        onChange={(e) => handleInputChange('className', e.target.value)}
                      />
                    </Form.Group>

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-100 fw-semibold"
                      disabled={isLoading || successMessage !== ''}
                    >
                      {isLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Creating Account...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-check-circle me-2"></i>
                          Create Account
                        </>
                      )}
                    </Button>
                  </Form>
                </Tab>

                <Tab 
                  eventKey="email" 
                  title={<><i className="fas fa-envelope me-2"></i>Email Address</>}
                >
                  <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3 mt-4">
                      <Form.Label className="fw-semibold">
                        <i className="fas fa-user me-2"></i>
                        Full Name <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        size="lg"
                        placeholder="Enter your full name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        isInvalid={!!errors.name}
                        required
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.name}
                      </Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold">
                        <i className="fas fa-envelope me-2"></i>
                        Email Address <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="email"
                        size="lg"
                        placeholder="Enter your email address"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value.toLowerCase())}
                        isInvalid={!!errors.email}
                        required
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.email}
                      </Form.Control.Feedback>
                      <Form.Text className="text-muted">
                        <i className="fas fa-info-circle me-1"></i>
                        You'll receive OTP on this email for login
                      </Form.Text>
                    </Form.Group>

                    <Form.Group className="mb-4">
                      <Form.Label className="fw-semibold">
                        <i className="fas fa-school me-2"></i>
                        Class/Grade (Optional)
                      </Form.Label>
                      <Form.Control
                        type="text"
                        size="lg"
                        placeholder="e.g., Class 10, Grade 12, JEE 2025"
                        value={formData.className}
                        onChange={(e) => handleInputChange('className', e.target.value)}
                      />
                    </Form.Group>

                    <Button
                      type="submit"
                      variant="success"
                      size="lg"
                      className="w-100 fw-semibold"
                      disabled={isLoading || successMessage !== ''}
                    >
                      {isLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Creating Account...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-check-circle me-2"></i>
                          Create Account
                        </>
                      )}
                    </Button>
                  </Form>
                </Tab>
              </Tabs>

              {/* Benefits Info */}
              <Alert variant="light" className="mt-4 mb-0 border">
                <div className="fw-semibold mb-2">
                  <i className="fas fa-gift text-success me-2"></i>
                  Why register with Quiz Master?
                </div>
                <ul className="mb-0 small">
                  <li>Access unlimited quizzes anytime</li>
                  <li>Track your performance and progress</li>
                  <li>Secure login with OTP - No password to remember</li>
                  <li>Get instant quiz results and feedback</li>
                </ul>
              </Alert>

              <hr className="my-4" />

              {/* Login Link */}
              <div className="text-center">
                <p className="mb-2 fw-semibold">Already have an account?</p>
                <Button
                  variant="outline-success"
                  onClick={onSwitchToLogin}
                  className="fw-semibold px-4"
                >
                  <i className="fas fa-sign-in-alt me-2"></i>
                  Login Now
                </Button>
              </div>
            </Card.Body>
          </Card>

          {/* Privacy Info */}
          <div className="text-center mt-3 text-muted small">
            <i className="fas fa-lock me-1"></i>
            Your information is safe and secure with us
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default RealStudentRegistration;
