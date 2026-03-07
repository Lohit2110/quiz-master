import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert, Modal } from 'react-bootstrap';
import { StorageUtils } from '../utils/storage';
import { useQuizContext } from '../contexts/QuizContext';

const DataManager: React.FC = () => {
  const { quizzes: savedQuizzes } = useQuizContext();
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportData, setExportData] = useState('');
  const [importData, setImportData] = useState('');
  const [alert, setAlert] = useState<{ type: 'success' | 'danger'; message: string } | null>(null);

  const handleExportData = () => {
    try {
      const data = {
        savedQuizzes: savedQuizzes,
        categories: StorageUtils.getCategories(),
        questions: StorageUtils.getQuestions(),
        studentResults: StorageUtils.getStudentResults(),
        exportDate: new Date().toISOString(),
        version: '1.0'
      };
      
      const jsonData = JSON.stringify(data, null, 2);
      setExportData(jsonData);
      setShowExportModal(true);
    } catch (error) {
      setAlert({ type: 'danger', message: 'Failed to export data. Please try again.' });
    }
  };

  const handleDownloadExport = () => {
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-master-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setAlert({ type: 'success', message: 'Data exported successfully! File downloaded.' });
    setShowExportModal(false);
  };

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportData).then(() => {
      setAlert({ type: 'success', message: 'Data copied to clipboard! You can paste it on another device.' });
      setShowExportModal(false);
    }).catch(() => {
      setAlert({ type: 'danger', message: 'Failed to copy to clipboard. Try manual copy.' });
    });
  };

  const handleImportData = () => {
    try {
      const data = JSON.parse(importData);
      
      // Validate data structure
      if (!data.savedQuizzes || !data.categories || !data.questions) {
        throw new Error('Invalid data format');
      }

      // Confirm import
      const confirmImport = window.confirm(
        'This will replace all your current data with the imported data. Are you sure you want to continue?'
      );

      if (!confirmImport) return;

      // Import data
      // Don't save quizzes to localStorage - causes quota errors
      // Quizzes are kept in React state and synced from Firebase
      StorageUtils.saveCategories(data.categories || []);
      StorageUtils.saveQuestions(data.questions || []);
      if (data.studentResults) {
        StorageUtils.saveStudentResults(data.studentResults);
      }

      setAlert({ type: 'success', message: 'Data imported successfully! Page will reload.' });
      setShowImportModal(false);
      setImportData('');
      
      // Reload page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      setAlert({ type: 'danger', message: 'Invalid data format. Please check your import data.' });
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportData(content);
    };
    reader.readAsText(file);
  };

  const getStorageInfo = () => {
    const categories = StorageUtils.getCategories();
    const questions = StorageUtils.getQuestions();
    const studentResults = StorageUtils.getStudentResults();

    return {
      savedQuizzes: savedQuizzes.length,
      categories: categories.length,
      questions: questions.length,
      studentResults: studentResults.length
    };
  };

  const storageInfo = getStorageInfo();

  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm">
            <Card.Header className="bg-primary text-white">
              <h4 className="mb-0">
                <i className="fas fa-database me-2"></i>
                Data Management
              </h4>
            </Card.Header>
            <Card.Body>
              {alert && (
                <Alert variant={alert.type} dismissible onClose={() => setAlert(null)}>
                  {alert.message}
                </Alert>
              )}

              <Row className="mb-4">
                <Col md={6}>
                  <Card className="h-100">
                    <Card.Header>
                      <h6 className="mb-0">Current Data Summary</h6>
                    </Card.Header>
                    <Card.Body>
                      <div className="mb-2">
                        <strong>Saved Quizzes:</strong> {storageInfo.savedQuizzes}
                      </div>
                      <div className="mb-2">
                        <strong>Categories:</strong> {storageInfo.categories}
                      </div>
                      <div className="mb-2">
                        <strong>Questions:</strong> {storageInfo.questions}
                      </div>
                      <div className="mb-2">
                        <strong>Student Results:</strong> {storageInfo.studentResults}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="h-100">
                    <Card.Header>
                      <h6 className="mb-0">Cross-Device Access</h6>
                    </Card.Header>
                    <Card.Body>
                      <p className="small text-muted mb-3">
                        Your data is stored locally on this device. To access your quizzes on other devices, 
                        you need to export and import your data.
                      </p>
                      <div className="d-grid gap-2">
                        <Button variant="success" onClick={handleExportData}>
                          <i className="fas fa-download me-2"></i>
                          Export Data
                        </Button>
                        <Button variant="primary" onClick={() => setShowImportModal(true)}>
                          <i className="fas fa-upload me-2"></i>
                          Import Data
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Alert variant="info">
                <h6><i className="fas fa-info-circle me-2"></i>How to Use Cross-Device Sync:</h6>
                <ol className="mb-0">
                  <li><strong>Export:</strong> Click "Export Data" to download your quizzes as a backup file</li>
                  <li><strong>Transfer:</strong> Send the file to your other device (email, cloud storage, etc.)</li>
                  <li><strong>Import:</strong> On the new device, click "Import Data" and upload the backup file</li>
                </ol>
              </Alert>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Export Modal */}
      <Modal show={showExportModal} onHide={() => setShowExportModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Export Data</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Your data has been prepared for export. Choose an option:</p>
          <div className="mb-3">
            <Button variant="success" className="me-2" onClick={handleDownloadExport}>
              <i className="fas fa-download me-2"></i>
              Download File
            </Button>
            <Button variant="primary" onClick={handleCopyExport}>
              <i className="fas fa-copy me-2"></i>
              Copy to Clipboard
            </Button>
          </div>
          <Form.Group>
            <Form.Label>Data Preview:</Form.Label>
            <Form.Control
              as="textarea"
              rows={10}
              value={exportData}
              readOnly
              style={{ fontSize: '12px' }}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowExportModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Import Modal */}
      <Modal show={showImportModal} onHide={() => setShowImportModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Import Data</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            <strong>Warning:</strong> This will replace all your current data. Make sure to export your current data first if you want to keep it.
          </Alert>
          
          <Form.Group className="mb-3">
            <Form.Label>Upload Backup File:</Form.Label>
            <Form.Control
              type="file"
              accept=".json"
              onChange={handleFileImport}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Or Paste Data:</Form.Label>
            <Form.Control
              as="textarea"
              rows={10}
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="Paste your exported data here..."
              style={{ fontSize: '12px' }}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowImportModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleImportData}
            disabled={!importData.trim()}
          >
            Import Data
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default DataManager;
