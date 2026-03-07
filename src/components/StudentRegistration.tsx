import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { otpService } from '../services/OTPService';

interface StudentRegistrationProps {
  onRegistrationSuccess: () => void;
  onSwitchToLogin: () => void;
}

const StudentRegistration: React.FC<StudentRegistrationProps> = ({ 
  onRegistrationSuccess, 
  onSwitchToLogin 
}) => {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    mobile: '',
    className: '',
    authType: 'email' // 'email' or 'passcode'
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

    // Email validation (now required)
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    // Mobile validation (optional)
    if (formData.mobile.trim() && !/^[6-9]\d{9}$/.test(formData.mobile.replace(/\D/g, ''))) {
      newErrors.mobile = 'Please enter a valid 10-digit mobile number';
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

    // Choose registration method based on authType
    let result;
    
    if (formData.authType === 'passcode') {
      // Simple passcode registration (easier for students)
      result = otpService.createSimplePasscode(
        formData.email.trim(),
        formData.name.trim(),
        formData.className.trim() || undefined
      );
      
      if (result.success) {
        setSuccessMessage(`${result.message} Please save your passcode: ${result.passcode}`);
        setTimeout(() => {
          onRegistrationSuccess();
        }, 5000); // Give more time to see passcode
      } else {
        setErrors({ submit: result.message });
      }
    } else {
      // Email OTP registration
      result = otpService.registerStudent(
        formData.email.trim(),
        formData.name.trim(),
        formData.mobile.replace(/\D/g, '') || undefined,
        formData.className.trim() || undefined
      );

      if (result.success) {
        setSuccessMessage(result.message);
        setTimeout(() => {
          onRegistrationSuccess();
        }, 2000);
      } else {
        setErrors({ submit: result.message });
      }
    }

    setIsLoading(false);
  };

  return (
    <Container className="min-vh-100 d-flex align-items-center">
      <Row className="w-100 justify-content-center">
        <Col md={6} lg={5}>
          <Card className="shadow-lg border-0">
            <Card.Header className="bg-primary text-white text-center py-4">
              <h3 className="fw-bold mb-1">
                <i className="fas fa-user-plus me-2"></i>
                Student Registration
              </h3>
              <p className="mb-0 opacity-75">Join Quiz Master Platform</p>
            </Card.Header>
            
            <Card.Body className="p-4">
              {successMessage && (
                <Alert variant="success" className="text-center">
                  <i className="fas fa-check-circle me-2"></i>
                  {successMessage}
                </Alert>
              )}

              {errors.submit && (
                <Alert variant="danger">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  {errors.submit}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                {/* Authentication Type Selection */}
                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold">
                    <i className="fas fa-key me-2"></i>
                    Choose Registration Method
                  </Form.Label>
                  <div className="d-flex gap-3">
                    <Form.Check
                      type="radio"
                      id="auth-email"
                      name="authType"
                      label="Email + OTP (Recommended)"
                      checked={formData.authType === 'email'}
                      onChange={() => handleInputChange('authType', 'email')}
                    />
                    <Form.Check
                      type="radio"
                      id="auth-passcode"
                      name="authType"
                      label="Simple Passcode (Quick)"
                      checked={formData.authType === 'passcode'}
                      onChange={() => handleInputChange('authType', 'passcode')}
                    />
                  </div>
                  <Form.Text className="text-muted">
                    {formData.authType === 'email' 
                      ? 'You\'ll receive OTP via email for login' 
                      : 'You\'ll get a 6-character passcode for quick login'
                    }
                  </Form.Text>
                </Form.Group>

                {/* Email Address */}
                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold">
                    <i className="fas fa-envelope me-2"></i>
                    Email Address *
                  </Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="Enter your email address"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    isInvalid={!!errors.email}
                  />
                  {errors.email && (
                    <Form.Control.Feedback type="invalid">
                      {errors.email}
                    </Form.Control.Feedback>
                  )}
                  <Form.Text className="text-muted">
                    {formData.authType === 'email' 
                      ? 'We\'ll send OTP to this email for login'
                      : 'Your login username'
                    }
                  </Form.Text>
                </Form.Group>

                {/* Name */}
                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold">
                    <i className="fas fa-user me-2"></i>
                    Full Name *
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    isInvalid={!!errors.name}
                  />
                  {errors.name && (
                    <Form.Control.Feedback type="invalid">
                      {errors.name}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>

                {/* Mobile Number (Optional) */}
                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold">
                    <i className="fas fa-mobile-alt me-2"></i>
                    Mobile Number
                  </Form.Label>
                  <InputGroup>
                    <InputGroup.Text>+91</InputGroup.Text>
                    <Form.Control
                      type="tel"
                      placeholder="Enter 10-digit mobile number (optional)"
                      value={formData.mobile}
                      onChange={(e) => handleInputChange('mobile', e.target.value)}
                      isInvalid={!!errors.mobile}
                      maxLength={10}
                    />
                  </InputGroup>
                  {errors.mobile && (
                    <Form.Control.Feedback type="invalid">
                      {errors.mobile}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>

                {/* Class (Optional) */}
                <Form.Group className="mb-4">
                  <Form.Label className="fw-semibold">
                    <i className="fas fa-graduation-cap me-2"></i>
                    Class/Grade
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter your class/grade (optional)"
                    value={formData.className}
                    onChange={(e) => handleInputChange('className', e.target.value)}
                  />
                </Form.Group>

                {/* Submit Button */}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-100 fw-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Registering...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-user-plus me-2"></i>
                      Register Account
                    </>
                  )}
                </Button>
              </Form>

              <hr className="my-4" />

              {/* Switch to Login */}
              <div className="text-center">
                <p className="mb-2">Already have an account?</p>
                <Button 
                  variant="outline-primary"
                  onClick={onSwitchToLogin}
                  className="fw-semibold"
                >
                  <i className="fas fa-sign-in-alt me-2"></i>
                  Login with Email
                </Button>
              </div>
            </Card.Body>
          </Card>

          {/* Physics Wallah Style Note */}
          <div className="text-center mt-3">
            <small className="text-muted">
              <i className="fas fa-shield-alt me-1"></i>
              Secure registration - Choose between Email OTP or Simple Passcode authentication
            </small>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default StudentRegistration;