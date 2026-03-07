import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert, Card, Row, Col } from 'react-bootstrap';
import { localFileSystem } from '../services/LocalFileSystemService';

interface StoragePermissionModalProps {
  show: boolean;
  onPermissionGranted: () => void;
  onPermissionDenied: () => void;
  userRole: 'student' | 'admin';
}

const StoragePermissionModal: React.FC<StoragePermissionModalProps> = ({
  show,
  onPermissionGranted,
  onPermissionDenied,
  userRole
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    setIsSupported(localFileSystem.isSupported());
  }, []);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    setError(null);

    try {
      const granted = await localFileSystem.requestStoragePermission();
      
      if (granted) {
        // Sync existing data to file system
        await localFileSystem.syncBrowserToFileSystem();
        onPermissionGranted();
      } else {
        setError('Permission was denied. You can continue using browser storage.');
        setTimeout(() => {
          onPermissionDenied();
        }, 3000);
      }
    } catch (err: any) {
      setError(`Error requesting permission: ${err.message}`);
      setTimeout(() => {
        onPermissionDenied();
      }, 3000);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSkip = () => {
    onPermissionDenied();
  };

  if (!isSupported) {
    return (
      <Modal show={show} backdrop="static" keyboard={false} centered>
        <Modal.Header>
          <Modal.Title>
            <i className="fas fa-info-circle text-info me-2"></i>
            Browser Storage Only
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info">
            <i className="fas fa-browser me-2"></i>
            <strong>File System Access Not Supported</strong>
            <p className="mb-0 mt-2">
              Your browser doesn't support direct file system access. 
              Don't worry - your data will be stored in browser storage and you can 
              still export/import quizzes manually.
            </p>
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={handleSkip}>
            Continue with Browser Storage
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  return (
    <Modal show={show} backdrop="static" keyboard={false} centered size="lg">
      <Modal.Header>
        <Modal.Title>
          <i className="fas fa-folder-open text-primary me-2"></i>
          Local Storage Access
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="info" className="mb-4">
          <i className="fas fa-info-circle me-2"></i>
          <strong>Enhanced Storage Experience</strong>
          <p className="mb-0 mt-2">
            {userRole === 'student' 
              ? 'Get automatic quiz updates directly to your computer!' 
              : 'Save quizzes directly to your computer for better organization!'}
          </p>
        </Alert>

        <Card className="border-0 bg-light mb-4">
          <Card.Body>
            <h5 className="fw-bold text-success mb-3">
              <i className="fas fa-check-circle me-2"></i>
              Benefits of Local Storage Access:
            </h5>
            <Row>
              <Col md={6}>
                <ul className="list-unstyled">
                  <li className="mb-2">
                    <i className="fas fa-download text-primary me-2"></i>
                    <strong>Automatic Updates:</strong> {userRole === 'student' ? 'Get new quizzes instantly' : 'Auto-backup all quizzes'}
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-offline text-success me-2"></i>
                    <strong>Offline Access:</strong> Works without internet
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-shield-alt text-info me-2"></i>
                    <strong>Privacy:</strong> Data stays on your computer
                  </li>
                </ul>
              </Col>
              <Col md={6}>
                <ul className="list-unstyled">
                  <li className="mb-2">
                    <i className="fas fa-folder text-warning me-2"></i>
                    <strong>Organization:</strong> Proper folder structure
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-rocket text-danger me-2"></i>
                    <strong>Performance:</strong> Faster loading
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-backup text-secondary me-2"></i>
                    <strong>Backup:</strong> Automatic file backups
                  </li>
                </ul>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Alert variant="warning" className="mb-4">
          <i className="fas fa-folder-plus me-2"></i>
          <strong>What happens next:</strong>
          <p className="mb-0 mt-2">
            1. You'll choose a folder on your computer<br/>
            2. We'll create a "QuizMaster" folder with organized subfolders<br/>
            3. {userRole === 'student' 
                ? 'New quizzes will automatically appear in your folder' 
                : 'Your quizzes will be automatically saved to files'}
          </p>
        </Alert>

        {error && (
          <Alert variant="danger">
            <i className="fas fa-exclamation-triangle me-2"></i>
            {error}
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button 
          variant="outline-secondary" 
          onClick={handleSkip}
          disabled={isRequesting}
        >
          <i className="fas fa-times me-2"></i>
          Skip (Use Browser Storage)
        </Button>
        <Button 
          variant="primary" 
          onClick={handleRequestPermission}
          disabled={isRequesting}
        >
          {isRequesting ? (
            <>
              <span className="spinner-border spinner-border-sm me-2"></span>
              Requesting Permission...
            </>
          ) : (
            <>
              <i className="fas fa-folder-open me-2"></i>
              Grant Storage Access
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default StoragePermissionModal;
