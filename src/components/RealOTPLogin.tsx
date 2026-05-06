import React, { useState, useEffect } from 'react';
import { realOTPService } from '../services/RealOTPService';
import { useAuth } from '../contexts/AuthContext';
import { googleAuthService } from '../services/GoogleAuthService';

interface RealOTPLoginProps {
  onSwitchToRegistration: () => void;
  onAdminLogin: () => void;
}

const RealOTPLogin: React.FC<RealOTPLoginProps> = ({ onSwitchToRegistration, onAdminLogin }) => {
  const [loginType, setLoginType] = useState<'mobile' | 'email'>('mobile');
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const { login, googleLogin } = useAuth();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpTimer > 0) {
      interval = setInterval(() => setOtpTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  // Handle Google redirect result (fallback from popup-blocked scenario)
  useEffect(() => {
    googleAuthService.handleRedirectResult().then(result => {
      if (result.success && result.user) {
        googleLogin(result.user);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoogleSignIn = async () => {
    setGoogleError('');
    setGoogleLoading(true);
    try {
      const result = await googleAuthService.signInWithGoogle();
      if (result.success && result.user) {
        googleLogin(result.user);
      } else if (result.message) {
        setGoogleError(result.message);
      }
    } catch (err: any) {
      setGoogleError('Google Sign-In failed. Please try again.');
    }
    setGoogleLoading(false);
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!identifier.trim()) {
      setError(`Please enter your ${loginType === 'mobile' ? 'mobile number' : 'email address'}`);
      return;
    }

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
        setOtpTimer(300);
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
      const loginSuccess = login('Student1234', result.student);
      if (!loginSuccess) setError('Login failed. Please try again.');
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
      if (result.success) { setSuccess(result.message); setOtpTimer(300); }
      else setError(result.message);
    } catch {
      setError('Failed to resend OTP. Please try again.');
    }
    setIsLoading(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleBack = () => { setStep('input'); setOtp(''); setError(''); setSuccess(''); };

  // ── OTP Verification Step ──────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ ...styles.header, background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            <div style={styles.logo}>🔐</div>
            <h2 style={styles.headerTitle}>Enter OTP</h2>
            <p style={styles.headerSub}>
              {loginType === 'mobile'
                ? `Sent to ******${identifier.slice(-4)}`
                : `Sent to ${identifier.split('@')[0].charAt(0)}***@${identifier.split('@')[1]}`}
            </p>
          </div>

          <div style={styles.body}>
            {error && <div style={styles.errorBox}>{error}</div>}
            {success && <div style={styles.successBox}>{success}</div>}

            <form onSubmit={handleVerifyOTP}>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                autoFocus
                style={styles.otpInput}
              />
              <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
                {otpTimer > 0
                  ? <>⏱ OTP expires in <strong>{formatTime(otpTimer)}</strong></>
                  : <span style={{ color: '#ef4444' }}>⚠ OTP has expired</span>}
              </p>

              <button
                type="submit"
                style={{ ...styles.primaryBtn, background: '#f59e0b', color: '#1f2937' }}
                disabled={isLoading || otpTimer === 0 || otp.length !== 6}
              >
                {isLoading ? 'Verifying...' : '✓ Verify & Login'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              {otpTimer > 0
                ? <small style={{ color: '#9ca3af' }}>Resend in {formatTime(otpTimer)}</small>
                : <button onClick={handleResendOTP} disabled={isLoading} style={styles.linkBtn}>↺ Resend OTP</button>}
            </div>
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <button onClick={handleBack} style={{ ...styles.linkBtn, color: '#9ca3af' }}>
                ← Change {loginType === 'mobile' ? 'Mobile Number' : 'Email'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Login Page ────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>🧠</div>
          <h2 style={styles.headerTitle}>Quiz Master</h2>
          <p style={styles.headerSub}>Student Login</p>
        </div>

        <div style={styles.body}>
          {/* Error Banners */}
          {googleError && (
            <div style={styles.errorBox}>
              {googleError}
              <button onClick={() => setGoogleError('')} style={styles.dismissBtn}>✕</button>
            </div>
          )}
          {error && (
            <div style={styles.errorBox}>
              {error}
              <button onClick={() => setError('')} style={styles.dismissBtn}>✕</button>
            </div>
          )}
          {success && (
            <div style={styles.successBox}>
              {success}
            </div>
          )}

          {/* ── Google Sign-In ── */}
          <button
            id="google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            style={styles.googleBtn}
          >
            {googleLoading ? (
              <>
                <span style={styles.spinner}></span>
                Signing in with Google...
              </>
            ) : (
              <>
                <svg width="22" height="22" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {/* Divider */}
          <div style={styles.divider}>
            <hr style={styles.dividerLine} />
            <span style={styles.dividerText}>or login with OTP</span>
            <hr style={styles.dividerLine} />
          </div>

          {/* Toggle OTP section */}
          {!showOTP ? (
            <button onClick={() => setShowOTP(true)} style={styles.otpToggleBtn}>
              📱 Login with Mobile / Email OTP instead
            </button>
          ) : (
            <>
              {/* Tab switcher */}
              <div style={styles.tabRow}>
                <button
                  style={{ ...styles.tab, ...(loginType === 'mobile' ? styles.tabActive : {}) }}
                  onClick={() => { setLoginType('mobile'); setIdentifier(''); setError(''); }}
                >📱 Mobile</button>
                <button
                  style={{ ...styles.tab, ...(loginType === 'email' ? styles.tabActive : {}) }}
                  onClick={() => { setLoginType('email'); setIdentifier(''); setError(''); }}
                >✉ Email</button>
              </div>

              <form onSubmit={handleSendOTP}>
                {loginType === 'mobile' ? (
                  <div style={styles.inputGroup}>
                    <span style={styles.inputPrefix}>🇮🇳 +91</span>
                    <input
                      type="tel"
                      placeholder="10-digit mobile number"
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      maxLength={10}
                      style={styles.inputWithPrefix}
                    />
                  </div>
                ) : (
                  <input
                    type="email"
                    placeholder="Enter your email address"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value.toLowerCase())}
                    style={styles.input}
                  />
                )}
                <button
                  type="submit"
                  style={styles.primaryBtn}
                  disabled={isLoading || (loginType === 'mobile' && identifier.length !== 10)}
                >
                  {isLoading ? 'Sending...' : '✉ Send OTP'}
                </button>
              </form>
            </>
          )}

          <hr style={{ margin: '1.2rem 0', borderColor: '#e5e7eb' }} />

          {/* Footer links */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 0.5rem', color: '#6b7280', fontSize: '0.9rem' }}>Don't have an account?</p>
            <button onClick={onSwitchToRegistration} style={styles.outlineBtn}>
              👤 Create New Account
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '0.8rem' }}>
            <button onClick={onAdminLogin} style={{ ...styles.linkBtn, color: '#9ca3af', fontSize: '0.8rem' }}>
              🛡 Admin / Teacher Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '1rem',
  },
  card: {
    background: '#fff',
    borderRadius: '20px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
    width: '100%',
    maxWidth: '440px',
    overflow: 'hidden',
  },
  header: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    padding: '2rem 1.5rem 1.5rem',
    textAlign: 'center',
    color: '#fff',
  },
  logo: {
    fontSize: '2.8rem',
    marginBottom: '0.4rem',
    lineHeight: 1,
  },
  headerTitle: {
    margin: 0,
    fontWeight: 800,
    fontSize: '1.6rem',
    letterSpacing: '-0.5px',
  },
  headerSub: {
    margin: '0.25rem 0 0',
    opacity: 0.85,
    fontSize: '0.9rem',
  },
  body: {
    padding: '1.6rem',
  },
  errorBox: {
    background: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    padding: '0.75rem 1rem',
    fontSize: '0.88rem',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  successBox: {
    background: '#f0fdf4',
    color: '#16a34a',
    border: '1px solid #bbf7d0',
    borderRadius: '10px',
    padding: '0.75rem 1rem',
    fontSize: '0.88rem',
    marginBottom: '1rem',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#dc2626',
    fontWeight: 700,
    padding: 0,
    flexShrink: 0,
  },
  googleBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '0.85rem 1rem',
    background: '#ffffff',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#374151',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    transition: 'all 0.2s ease',
    marginBottom: '1rem',
  },
  spinner: {
    width: '18px',
    height: '18px',
    border: '2px solid #e5e7eb',
    borderTopColor: '#6366f1',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 0.8s linear infinite',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  dividerLine: {
    flex: 1,
    margin: 0,
    borderColor: '#e5e7eb',
    borderWidth: '1px',
  },
  dividerText: {
    color: '#9ca3af',
    fontSize: '0.78rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  otpToggleBtn: {
    width: '100%',
    padding: '0.7rem',
    background: '#f3f4f6',
    border: '1.5px dashed #d1d5db',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '0.88rem',
    color: '#6366f1',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  tabRow: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  tab: {
    flex: 1,
    padding: '0.55rem',
    border: '1.5px solid #e5e7eb',
    borderRadius: '8px',
    background: '#f9fafb',
    cursor: 'pointer',
    fontSize: '0.85rem',
    color: '#6b7280',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  tabActive: {
    background: '#6366f1',
    borderColor: '#6366f1',
    color: '#fff',
    fontWeight: 700,
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    border: '1.5px solid #d1d5db',
    borderRadius: '10px',
    overflow: 'hidden',
    marginBottom: '0.75rem',
  },
  inputPrefix: {
    padding: '0.7rem 0.8rem',
    background: '#f3f4f6',
    color: '#374151',
    fontSize: '0.9rem',
    fontWeight: 600,
    borderRight: '1.5px solid #d1d5db',
    whiteSpace: 'nowrap',
  },
  inputWithPrefix: {
    flex: 1,
    padding: '0.7rem 0.9rem',
    border: 'none',
    outline: 'none',
    fontSize: '1rem',
    fontFamily: 'monospace',
    letterSpacing: '0.1rem',
    background: '#fff',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    border: '1.5px solid #d1d5db',
    borderRadius: '10px',
    fontSize: '1rem',
    outline: 'none',
    marginBottom: '0.75rem',
    boxSizing: 'border-box',
  },
  primaryBtn: {
    width: '100%',
    padding: '0.8rem',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: '0.3rem',
  },
  outlineBtn: {
    padding: '0.65rem 1.5rem',
    background: 'transparent',
    border: '2px solid #6366f1',
    borderRadius: '10px',
    color: '#6366f1',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6366f1',
    fontWeight: 600,
    fontSize: '0.9rem',
    textDecoration: 'underline',
    padding: 0,
  },
  otpInput: {
    width: '100%',
    textAlign: 'center',
    fontSize: '2.5rem',
    fontFamily: 'monospace',
    fontWeight: 700,
    letterSpacing: '1rem',
    padding: '0.75rem 0.5rem',
    border: '2px solid #d1d5db',
    borderRadius: '12px',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: '0.75rem',
    color: '#1f2937',
  },
};

// Add CSS animation for spinner
const styleTag = document.createElement('style');
styleTag.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
if (!document.querySelector('[data-quiz-spinner]')) {
  styleTag.setAttribute('data-quiz-spinner', '1');
  document.head.appendChild(styleTag);
}

export default RealOTPLogin;
