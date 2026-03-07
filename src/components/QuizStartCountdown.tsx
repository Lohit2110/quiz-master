import React, { useState, useEffect } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { StudentInfo } from '../types';

interface QuizStartCountdownProps {
  show: boolean;
  quizTitle: string;
  questionCount: number;
  studentInfo: StudentInfo | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const QuizStartCountdown: React.FC<QuizStartCountdownProps> = ({
  show,
  quizTitle,
  questionCount,
  studentInfo,
  onConfirm,
  onCancel
}) => {
  const [showConfirmation, setShowConfirmation] = useState(true);
  const [showCountdown, setShowCountdown] = useState(false);
  const [showBestOfLuck, setShowBestOfLuck] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (show) {
      setShowConfirmation(true);
      setShowCountdown(false);
      setShowBestOfLuck(false);
      setCountdown(5);
    }
  }, [show]);

  const handleConfirm = () => {
    setShowConfirmation(false);
    setShowCountdown(true);
    
    // Start countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowCountdown(false);
          setShowBestOfLuck(true);
          
          // Show "Best of Luck" for 2 seconds then start quiz
          setTimeout(() => {
            setShowBestOfLuck(false);
            onConfirm();
          }, 2000);
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCancel = () => {
    setShowConfirmation(true);
    setShowCountdown(false);
    setShowBestOfLuck(false);
    onCancel();
  };

  if (!show) return null;

  return (
    <Modal 
      show={show} 
      backdrop="static" 
      keyboard={false} 
      centered
      size={showCountdown || showBestOfLuck ? "sm" : "lg"}
    >
      {showConfirmation && (
        <>
          <Modal.Header className="bg-primary text-white text-center">
            <Modal.Title className="w-100">
              <i className="fas fa-play-circle me-2"></i>
              Start Quiz Confirmation
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-center py-4">
            <div className="mb-4">
              <i className="fas fa-question-circle fa-3x text-primary mb-3"></i>
              <h4 className="text-primary mb-3">{quizTitle}</h4>
              <div className="alert alert-info">
                <h5 className="mb-2">
                  <i className="fas fa-info-circle me-2"></i>
                  Quiz Details
                </h5>
                <p className="mb-1">
                  <strong>Student:</strong> {studentInfo?.name}
                </p>
                {studentInfo?.email && (
                  <p className="mb-1">
                    <strong>Email:</strong> {studentInfo.email}
                  </p>
                )}
                <p className="mb-1">
                  <strong>Total Questions:</strong> {questionCount}
                </p>
                <p className="mb-0">
                  <strong>Instructions:</strong> Read each question carefully and select the best answer.
                </p>
              </div>
            </div>
            <div className="alert alert-warning">
              <i className="fas fa-exclamation-triangle me-2"></i>
              <strong>Ready to begin?</strong> Once you start, the timer will begin and you cannot pause the quiz.
            </div>
          </Modal.Body>
          <Modal.Footer className="justify-content-center">
            <Button variant="secondary" onClick={handleCancel} size="lg">
              <i className="fas fa-times me-2"></i>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirm} size="lg">
              <i className="fas fa-play me-2"></i>
              Start Quiz
            </Button>
          </Modal.Footer>
        </>
      )}

      {showCountdown && (
        <>
          <Modal.Body className="text-center py-5">
            <div className="countdown-container">
              <h2 className="text-muted mb-3">Quiz Starting In</h2>
              <div className={`countdown-number countdown-${countdown}`}>
                {countdown}
              </div>
              <p className="text-muted mt-3">Get ready...</p>
            </div>
          </Modal.Body>
        </>
      )}

      {showBestOfLuck && (
        <>
          <Modal.Body className="text-center py-5">
            <div className="best-of-luck-container">
              <i className="fas fa-star fa-3x text-warning mb-3 pulse-animation"></i>
              <h2 className="text-primary mb-2 fade-in-animation">Best of Luck!</h2>
              <p className="text-muted fade-in-animation">You've got this! 🚀</p>
            </div>
          </Modal.Body>
        </>
      )}
    </Modal>
  );
};

export default QuizStartCountdown;
