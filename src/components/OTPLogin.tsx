import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { otpService } from '../services/OTPService';
import { useAuth } from '../contexts/AuthContext';

interface OTPLoginProps {
  onSwitchToRegistration: () => void;
  onAdminLogin: () => void;
}

const OTPLogin: React.FC<OTPLoginProps> = ({ onSwitchToRegistration, onAdminLogin }) => {
  const [step, setStep] = useState<'email' | 'otp' | 'passcode'>('email');
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [demoOTP, setDemoOTP] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<'otp' | 'passcode'>('otp');
  const { login } = useAuth();

  // OTP Timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await otpService.sendOTP(email.trim().toLowerCase());
      
      if (result.success) {
        setStep('otp');
        setOtpTimer(300); // 5 minutes
        setDemoOTP(result.demoOTP || null);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Failed to send OTP. Please try again.');
    }
    
    setIsLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp.trim() || otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    setIsLoading(true);

    const result = otpService.verifyOTP(email.trim().toLowerCase(), otp);

    if (result.success && result.student) {
      // Use the Auth context to log in the student
      const loginSuccess = login('Student1234', result.student);
      if (loginSuccess) {
        console.log('Student OTP login successful');
      } else {
        setError('Login failed. Please try again.');
      }
    } else {
      setError(result.message);
    }

    setIsLoading(false);
  };

  const handlePasscodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !passcode.trim()) {
      setError('Please enter both email and passcode');
      return;
    }

    setIsLoading(true);

    const result = otpService.loginWithPasscode(email.trim().toLowerCase(), passcode.trim());

    if (result.success && result.student) {
      // Use the Auth context to log in the student
      const loginSuccess = login('Student1234', result.student);
      if (loginSuccess) {
        console.log('Student passcode login successful');
      } else {
        setError('Login failed. Please try again.');
      }
    } else {
      setError(result.message);
    }

    setIsLoading(false);
  };

  const handleResendOTP = async () => {
    if (otpTimer > 0) return;

    setIsLoading(true);
    try {
      const result = await otpService.resendOTP(email.trim().toLowerCase());
      
      if (result.success) {
        setOtpTimer(300);
        setDemoOTP(result.demoOTP || null);
        setError('');
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Failed to resend OTP. Please try again.');
    }
    
    setIsLoading(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (step === 'email') {
    return (
      <Container className="min-vh-100 d-flex align-items-center">
        <Row className="w-100 justify-content-center">
          <Col md={6} lg={5}>
            <Card className="shadow-lg border-0">
              <Card.Header className="bg-success text-white text-center py-4">
                <h3 className="fw-bold mb-1">
                  <i className="fas fa-envelope me-2"></i>
                  Student Login
                </h3>
                <p className="mb-0 opacity-75">Choose your login method</p>
              </Card.Header>
              
              <Card.Body className="p-4">
                {error && (
                  <Alert variant="danger">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    {error}
                  </Alert>
                )}

                {/* Login Method Selection */}
                <div className="mb-4">
                  <Form.Label className="fw-semibold mb-3">
                    <i className="fas fa-key me-2"></i>
                    Choose Login Method
                  </Form.Label>
                  <div className="d-flex gap-3 mb-3">
                    <Form.Check
                      type="radio"
                      id="login-otp"
                      name="loginMode"
                      label="Email + OTP"
                      checked={loginMode === 'otp'}
                      onChange={() => setLoginMode('otp')}
                    />
                    <Form.Check
                      type="radio"
                      id="login-passcode"
                      name="loginMode"
                      label="Email + Passcode"
                      checked={loginMode === 'passcode'}
                      onChange={() => setLoginMode('passcode')}
                    />
                  </div>
                </div>

                {loginMode === 'otp' ? (
                  <Form onSubmit={handleSendOTP}>
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-semibold">
                        <i className="fas fa-envelope me-2"></i>
                        Registered Email Address
                      </Form.Label>
                      <Form.Control
                        type="email"
                        size="lg"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                      <Form.Text className="text-muted">
                        Enter the email address you registered with
                      </Form.Text>
                    </Form.Group>

                    <Button
                      type="submit"
                      variant="success"
                      size="lg"
                      className="w-100 fw-semibold"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Sending OTP...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-paper-plane me-2"></i>
                          Send OTP to Email
                        </>
                      )}
                    </Button>
                  </Form>
                ) : (
                  <Form onSubmit={handlePasscodeLogin}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold">
                        <i className="fas fa-envelope me-2"></i>
                        Email Address
                      </Form.Label>
                      <Form.Control
                        type="email"
                        size="lg"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-4">
                      <Form.Label className="fw-semibold">
                        <i className="fas fa-key me-2"></i>
                        6-Character Passcode
                      </Form.Label>
                      <Form.Control
                        type="text"
                        size="lg"
                        placeholder="Enter your passcode"
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value.toUpperCase())}
                        maxLength={6}
                        className="text-center"
                        style={{ fontSize: '1.2rem', letterSpacing: '0.2rem' }}
                        required
                      />
                      <Form.Text className="text-muted">
                        Enter the 6-character passcode you received during registration
                      </Form.Text>
                    </Form.Group>

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
                          Logging in...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-sign-in-alt me-2"></i>
                          Login with Passcode
                        </>
                      )}
                    </Button>
                  </Form>
                )}

                <hr className="my-4" />

                {/* Registration Link */}
                <div className="text-center">
                  <p className="mb-2">Don't have an account?</p>
                  <Button 
                    variant="outline-success"
                    onClick={onSwitchToRegistration}
                    className="fw-semibold"
                  >
                    <i className="fas fa-user-plus me-2"></i>
                    Register New Account
                  </Button>
                </div>

                {/* Admin Login Link */}
                <div className="text-center mt-3">
                  <Button 
                    variant="link"
                    onClick={onAdminLogin}
                    className="text-muted small"
                  >
                    <i className="fas fa-user-shield me-1"></i>
                    Admin Login
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    );
  }

  return (
    <Container className="min-vh-100 d-flex align-items-center">
      <Row className="w-100 justify-content-center">
        <Col md={6} lg={5}>
          <Card className="shadow-lg border-0">
            <Card.Header className="bg-warning text-dark text-center py-4">
              <h3 className="fw-bold mb-1">
                <i className="fas fa-key me-2"></i>
                Enter OTP
              </h3>
              <p className="mb-0">Sent to {email}</p>
            </Card.Header>
            
            <Card.Body className="p-4">
              {error && (
                <Alert variant="danger">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  {error}
                </Alert>
              )}

              {demoOTP && (
                <Alert variant="info">
                  <i className="fas fa-info-circle me-2"></i>
                  <strong>Demo Mode:</strong> Your OTP is <code>{demoOTP}</code>
                </Alert>
              )}

              <Form onSubmit={handleVerifyOTP}>
                <Form.Group className="mb-4">
                  <Form.Label className="fw-semibold">
                    <i className="fas fa-shield-alt me-2"></i>
                    6-Digit OTP
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                    size="lg"
                    className="text-center letter-spacing-2"
                    style={{ fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                    required
                  />
                  <Form.Text className="text-muted">
                    {otpTimer > 0 ? (
                      <>OTP expires in {formatTime(otpTimer)}</>
                    ) : (
                      <>OTP has expired</>
                    )}
                  </Form.Text>
                </Form.Group>

                <Button
                  type="submit"
                  variant="warning"
                  size="lg"
                  className="w-100 fw-semibold text-dark"
                  disabled={isLoading || otpTimer === 0}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Verifying...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check me-2"></i>
                      Verify & Login
                    </>
                  )}
                </Button>

                {/* Resend OTP */}
                <div className="text-center mt-3">
                  {otpTimer > 0 ? (
                    <small className="text-muted">
                      Didn't receive OTP? Wait {formatTime(otpTimer)} to resend
                    </small>
                  ) : (
                    <Button 
                      variant="link"
                      onClick={handleResendOTP}
                      disabled={isLoading}
                      className="fw-semibold"
                    >
                      <i className="fas fa-redo me-1"></i>
                      Resend OTP
                    </Button>
                  )}
                </div>

                {/* Change Number */}
                <div className="text-center mt-2">
                  <Button 
                    variant="link"
                    onClick={() => setStep('email')}
                    className="text-muted small"
                  >
                    <i className="fas fa-edit me-1"></i>
                    Change Email Address
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default OTPLogin;