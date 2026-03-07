import React, { useState, useEffect } from 'react';
import RealStudentRegistration from './RealStudentRegistration';
import RealOTPLogin from './RealOTPLogin';
import Login from './Login'; // Original admin login

type AuthMode = 'student-login' | 'student-registration' | 'admin-login';

const PhysicsWallahAuth: React.FC = () => {
  const [authMode, setAuthMode] = useState<AuthMode>('student-login');

  // Force logout all users on first load (clear all sessions)
  useEffect(() => {
    const hasLoggedOutAll = sessionStorage.getItem('quiz_master_initial_logout');
    
    if (!hasLoggedOutAll) {
      // Clear all authentication data
      localStorage.removeItem('quiz_master_auth');
      sessionStorage.clear();
      
      // Mark that we've done the initial logout
      sessionStorage.setItem('quiz_master_initial_logout', 'true');
      
      console.log('🚪 All users logged out - Fresh start!');
    }
  }, []);

  const handleRegistrationSuccess = () => {
    setAuthMode('student-login');
  };

  const handleSwitchToLogin = () => {
    setAuthMode('student-login');
  };

  const handleSwitchToRegistration = () => {
    setAuthMode('student-registration');
  };

  const handleAdminLogin = () => {
    setAuthMode('admin-login');
  };

  // Render different components based on mode
  switch (authMode) {
    case 'student-registration':
      return (
        <RealStudentRegistration 
          onRegistrationSuccess={handleRegistrationSuccess}
          onSwitchToLogin={handleSwitchToLogin}
        />
      );
    
    case 'admin-login':
      return <Login />;
    
    case 'student-login':
    default:
      return (
        <RealOTPLogin 
          onSwitchToRegistration={handleSwitchToRegistration}
          onAdminLogin={handleAdminLogin}
        />
      );
  }
};

export default PhysicsWallahAuth;