import React, { useState } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { StudentInfo } from '../types';

interface StudentInfoModalProps {
  show: boolean;
  onSubmit: (studentInfo: StudentInfo) => void;
  onCancel: () => void;
}

const StudentInfoModal: React.FC<StudentInfoModalProps> = ({
  show,
  onSubmit,
  onCancel
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [showError, setShowError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setShowError(true);
      return;
    }

    const studentInfo: StudentInfo = {
      name: name.trim(),
      email: email.trim() || undefined
    };

    onSubmit(studentInfo);
    
    // Reset form
    setName('');
    setEmail('');
    setShowError(false);
  };

  const handleCancel = () => {
    setName('');
    setEmail('');
    setShowError(false);
    onCancel();
  };

  return (
    <Modal show={show} backdrop="static" keyboard={false} centered>
      <Modal.Header className="bg-primary text-white">
        <Modal.Title>
          <i className="fas fa-user me-2"></i>
          Student Information
        </Modal.Title>
      </Modal.Header>
      
      <Form onSubmit={handleSubmit}>
        <Modal.Body className="py-4">
          <div className="text-center mb-4">
            <i className="fas fa-id-badge fa-3x text-primary mb-3"></i>
            <p className="text-muted">
              Please provide your information before starting the quiz. 
              This helps your teacher track your progress and results.
            </p>
          </div>

          {showError && (
            <Alert variant="danger">
              <i className="fas fa-exclamation-triangle me-2"></i>
              Please enter your name to continue.
            </Alert>
          )}

          <Form.Group className="mb-3">
            <Form.Label>
              <i className="fas fa-user me-2"></i>
              Full Name <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (showError) setShowError(false);
              }}
              required
              autoFocus
            />
            <Form.Text className="text-muted">
              This will be used to identify your quiz results.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>
              <i className="fas fa-envelope me-2"></i>
              Email Address <span className="text-muted">(Optional)</span>
            </Form.Label>
            <Form.Control
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Form.Text className="text-muted">
              Optional: Can be used for additional identification.
            </Form.Text>
          </Form.Group>

          <div className="alert alert-info">
            <i className="fas fa-info-circle me-2"></i>
            <strong>Privacy Note:</strong> Your information is stored locally and will only be used to track your quiz performance for educational purposes.
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleCancel}>
            <i className="fas fa-times me-2"></i>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            <i className="fas fa-arrow-right me-2"></i>
            Continue to Quiz
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default StudentInfoModal;
