import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Tabs, Tab } from 'react-bootstrap';
import { realOTPService } from '../services/RealOTPService';
import { useAuth } from '../contexts/AuthContext';

interface RealOTPLoginProps {
  onSwitchToRegistration: () => void;
  onAdminLogin: () => void;
}

const RealOTPLogin: React.FC<RealOTPLoginProps> = ({ onSwitchToRegistration, onAdminLogin }) => {
  const [loginType, setLoginType] = useState<'mobile' | 'email'>('mobile');
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [identifier, setIdentifier] = useState(''); // Mobile or Email
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
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
    setSuccess('');

    if (!identifier.trim()) {
      setError(`Please enter your ${loginType === 'mobile' ? 'mobile number' : 'email address'}`);
      return;
    }

    // Validate based on type
    if (loginType === 'mobile') {
      const cleanMobile = identifier.replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
        setError('Please enter a valid 10-digit mobile number');
        return;
      }
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
        setError('Please enter a valid email address');
        return;
      }
    }

    setIsLoading(true);

    try {
      const result = loginType === 'mobile'
        ? await realOTPService.sendSMSOTP(identifier)
        : await realOTPService.sendEmailOTP(identifier);

      if (result.success) {
        setSuccess(result.message);
        setStep('otp');
        setOtpTimer(300); // 5 minutes
      } else {
        setError(result.message);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to send OTP. Please try again.');
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

    const result = await realOTPService.verifyOTP(identifier, otp);

    if (result.success && result.student) {
      // Login successful
      const loginSuccess = login('Student1234', result.student);
      if (loginSuccess) {
        console.log('✅ Student logged in successfully');
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
    setError('');
    setSuccess('');

    try {
      const result = await realOTPService.resendOTP(identifier, loginType);

      if (result.success) {
        setSuccess(result.message);
        setOtpTimer(300);
      } else {
        setError(result.message);
      }
    } catch (error: any) {
      setError('Failed to resend OTP. Please try again.');
    }

    setIsLoading(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleBack = () => {
    setStep('input');
    setOtp('');
    setError('');
    setSuccess('');
  };

  if (step === 'input') {
    return (
      <Container className="min-vh-100 d-flex align-items-center py-5">
        <Row className="w-100 justify-content-center">
          <Col md={7} lg={6}>
            <Card className="shadow-lg border-0">
              <Card.Header className="bg-primary text-white text-center py-4">
                <h2 className="fw-bold mb-1">
                  <i className="fas fa-user-graduate me-2"></i>
                  Student Login
                </h2>
                <p className="mb-0 opacity-75">Login with OTP - No password needed!</p>
              </Card.Header>

              <Card.Body className="p-4">
                {error && (
                  <Alert variant="danger" dismissible onClose={() => setError('')}>
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    {error}
                  </Alert>
                )}

                {success && (
                  <Alert variant="success" dismissible onClose={() => setSuccess('')}>
                    <i className="fas fa-check-circle me-2"></i>
                    {success}
                  </Alert>
                )}

                {/* Login Type Selection */}
                <Tabs
                  activeKey={loginType}
                  onSelect={(k) => {
                    setLoginType(k as 'mobile' | 'email');
                    setIdentifier('');
                    setError('');
                    setSuccess('');
                  }}
                  className="mb-4 nav-fill"
                  variant="pills"
                >
                  <Tab 
                    eventKey="mobile" 
                    title={<><i className="fas fa-mobile-alt me-2"></i>Mobile Number</>}
                  >
                    <Form onSubmit={handleSendOTP}>
                      <Form.Group className="mb-4 mt-4">
                        <Form.Label className="fw-semibold">
                          <i className="fas fa-phone me-2"></i>
                          Mobile Number
                        </Form.Label>
                        <div className="input-group input-group-lg">
                          <span className="input-group-text bg-light">
                            <i className="fas fa-flag me-1"></i>+91
                          </span>
                          <Form.Control
                            type="tel"
                            placeholder="Enter 10-digit mobile number"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            maxLength={10}
                            required
                            style={{ fontSize: '1.1rem', letterSpacing: '0.1rem' }}
                          />
                        </div>
                        <Form.Text className="text-muted">
                          <i className="fas fa-info-circle me-1"></i>
                          We'll send an OTP to this number via SMS
                        </Form.Text>
                      </Form.Group>

                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="w-100 fw-semibold"
                        disabled={isLoading || identifier.length !== 10}
                      >
                        {isLoading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Sending OTP...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-paper-plane me-2"></i>
                            Send OTP via SMS
                          </>
                        )}
                      </Button>
                    </Form>
                  </Tab>

                  <Tab 
                    eventKey="email" 
                    title={<><i className="fas fa-envelope me-2"></i>Email Address</>}
                  >
                    <Form onSubmit={handleSendOTP}>
                      <Form.Group className="mb-4 mt-4">
                        <Form.Label className="fw-semibold">
                          <i className="fas fa-envelope me-2"></i>
                          Email Address
                        </Form.Label>
                        <Form.Control
                          type="email"
                          size="lg"
                          placeholder="Enter your email address"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value.toLowerCase())}
                          required
                        />
                        <Form.Text className="text-muted">
                          <i className="fas fa-info-circle me-1"></i>
                          We'll send an OTP to this email
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
                            Send OTP via Email
                          </>
                        )}
                      </Button>
                    </Form>
                  </Tab>
                </Tabs>

                {/* Info Banner */}
                <Alert variant="info" className="mt-4 mb-0">
                  <i className="fas fa-lightbulb me-2"></i>
                  <strong>New to Quiz Master?</strong> Register first to get started!
                </Alert>

                <hr className="my-4" />

                {/* Registration Link */}
                <div className="text-center">
                  <p className="mb-2 fw-semibold">Don't have an account?</p>
                  <Button
                    variant="outline-primary"
                    size="lg"
                    onClick={onSwitchToRegistration}
                    className="fw-semibold px-4"
                  >
                    <i className="fas fa-user-plus me-2"></i>
                    Create New Account
                  </Button>
                </div>

                {/* Admin Login Link */}
                <div className="text-center mt-4">
                  <Button
                    variant="link"
                    onClick={onAdminLogin}
                    className="text-muted"
                  >
                    <i className="fas fa-user-shield me-1"></i>
                    Admin/Teacher Login
                  </Button>
                </div>
              </Card.Body>
            </Card>

            {/* Security Badge */}
            <div className="text-center mt-3 text-muted small">
              <i className="fas fa-shield-alt me-1"></i>
              Secure OTP Login • No password required
            </div>
          </Col>
        </Row>
      </Container>
    );
  }

  // OTP Verification Step
  return (
    <Container className="min-vh-100 d-flex align-items-center py-5">
      <Row className="w-100 justify-content-center">
        <Col md={6} lg={5}>
          <Card className="shadow-lg border-0">
            <Card.Header className="bg-warning text-dark text-center py-4">
              <h3 className="fw-bold mb-1">
                <i className="fas fa-shield-alt me-2"></i>
                Enter OTP
              </h3>
              <p className="mb-0">
                {loginType === 'mobile' ? (
                  <>Sent to ******{identifier.slice(-4)}</>
                ) : (
                  <>Sent to {identifier.split('@')[0].charAt(0)}***@{identifier.split('@')[1]}</>
                )}
              </p>
            </Card.Header>

            <Card.Body className="p-4">
              {error && (
                <Alert variant="danger" dismissible onClose={() => setError('')}>
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert variant="success" dismissible onClose={() => setSuccess('')}>
                  <i className="fas fa-check-circle me-2"></i>
                  {success}
                </Alert>
              )}

              <Form onSubmit={handleVerifyOTP}>
                <Form.Group className="mb-4">
                  <Form.Label className="fw-semibold text-center d-block">
                    <i className="fas fa-key me-2"></i>
                    6-Digit OTP
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    size="lg"
                    className="text-center"
                    style={{ 
                      fontSize: '2rem', 
                      letterSpacing: '1rem',
                      fontWeight: 'bold',
                      fontFamily: 'monospace'
                    }}
                    required
                    autoFocus
                  />
                  <Form.Text className="text-muted text-center d-block mt-2">
                    {otpTimer > 0 ? (
                      <>
                        <i className="fas fa-clock me-1"></i>
                        OTP expires in <strong>{formatTime(otpTimer)}</strong>
                      </>
                    ) : (
                      <span className="text-danger">
                        <i className="fas fa-exclamation-circle me-1"></i>
                        OTP has expired
                      </span>
                    )}
                  </Form.Text>
                </Form.Group>

                <Button
                  type="submit"
                  variant="warning"
                  size="lg"
                  className="w-100 fw-semibold text-dark mb-3"
                  disabled={isLoading || otpTimer === 0 || otp.length !== 6}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Verifying...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check-circle me-2"></i>
                      Verify & Login
                    </>
                  )}
                </Button>

                {/* Resend OTP */}
                <div className="text-center mb-3">
                  {otpTimer > 0 ? (
                    <small className="text-muted">
                      Didn't receive OTP? Retry in <strong>{formatTime(otpTimer)}</strong>
                    </small>
                  ) : (
                    <Button
                      variant="link"
                      onClick={handleResendOTP}
                      disabled={isLoading}
                      className="fw-semibold p-0"
                    >
                      <i className="fas fa-redo me-1"></i>
                      Resend OTP
                    </Button>
                  )}
                </div>

                {/* Change Number/Email */}
                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={handleBack}
                    className="text-muted small"
                  >
                    <i className="fas fa-arrow-left me-1"></i>
                    Change {loginType === 'mobile' ? 'Mobile Number' : 'Email Address'}
                  </Button>
                </div>
              </Form>

              {/* OTP Info */}
              <Alert variant="light" className="mt-4 mb-0 border">
                <div className="small">
                  <div className="mb-2">
                    <i className="fas fa-info-circle text-primary me-2"></i>
                    <strong>Didn't receive OTP?</strong>
                  </div>
                  <ul className="mb-0 ps-4">
                    {loginType === 'mobile' ? (
                      <>
                        <li>Check your SMS inbox</li>
                        <li>Ensure you have network coverage</li>
                        <li>Wait for 30 seconds before resending</li>
                      </>
                    ) : (
                      <>
                        <li>Check your email inbox</li>
                        <li>Check spam/junk folder</li>
                        <li>Wait for 1 minute before resending</li>
                      </>
                    )}
                  </ul>
                </div>
              </Alert>
            </Card.Body>
          </Card>

          {/* Security Info */}
          <div className="text-center mt-3 text-muted small">
            <i className="fas fa-lock me-1"></i>
            OTP is valid for 5 minutes • Do not share with anyone
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default RealOTPLogin;
