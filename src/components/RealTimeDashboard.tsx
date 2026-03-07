import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Badge, Table, Button, Alert } from 'react-bootstrap';
import { realTimeQuizService } from '../services/RealTimeQuizService';

const RealTimeDashboard: React.FC = () => {
  const [activeStudents, setActiveStudents] = useState<any[]>([]);
  const [systemStats, setSystemStats] = useState<any>({});
  const [publicationLogs, setPublicationLogs] = useState<any[]>([]);
  const [studentLogs, setStudentLogs] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
    
    // Update dashboard every 5 seconds
    const interval = setInterval(loadDashboardData, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = () => {
    setActiveStudents(realTimeQuizService.getActiveStudents());
    setSystemStats(realTimeQuizService.getSystemStats());
    setPublicationLogs(realTimeQuizService.getPublicationLogs());
    setStudentLogs(realTimeQuizService.getStudentLogs().slice(-10)); // Last 10 activities
  };

  const handleForceSyncAll = () => {
    realTimeQuizService.forceSyncAllStudents();
    alert('Force sync triggered for all students!');
  };

  return (
    <div className="real-time-dashboard">
      <Row className="mb-4">
        <Col>
          <h3 className="fw-bold text-primary">
            <i className="fas fa-chart-line me-2"></i>
            Real-Time Dashboard
          </h3>
          <p className="text-muted">Monitor student activity and quiz distribution (Physics Wallah style)</p>
        </Col>
      </Row>

      {/* System Stats */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="text-center">
              <i className="fas fa-users fa-2x text-primary mb-2"></i>
              <h4 className="fw-bold">{systemStats.activeStudents || 0}</h4>
              <small className="text-muted">Students Online</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="text-center">
              <i className="fas fa-book fa-2x text-success mb-2"></i>
              <h4 className="fw-bold">{systemStats.totalQuizzes || 0}</h4>
              <small className="text-muted">Total Quizzes</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="text-center">
              <i className="fas fa-broadcast-tower fa-2x text-warning mb-2"></i>
              <h4 className="fw-bold">{systemStats.totalPublications || 0}</h4>
              <small className="text-muted">Publications</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="text-center">
              <i className="fas fa-clock fa-2x text-info mb-2"></i>
              <h4 className="fw-bold">
                {systemStats.systemUptime ? Math.round(systemStats.systemUptime / 60000) : 0}m
              </h4>
              <small className="text-muted">Uptime</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Active Students */}
      <Row className="mb-4">
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-primary text-white">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="fas fa-users me-2"></i>
                  Active Students ({activeStudents.length})
                </h5>
                <Button 
                  variant="light" 
                  size="sm" 
                  onClick={handleForceSyncAll}
                >
                  <i className="fas fa-sync me-1"></i>
                  Force Sync All
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {activeStudents.length === 0 ? (
                <Alert variant="info" className="mb-0">
                  <i className="fas fa-info-circle me-2"></i>
                  No students currently online
                </Alert>
              ) : (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Session ID</th>
                      <th>Login Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStudents.map((student, index) => (
                      <tr key={student.id || index}>
                        <td>
                          <strong>{student.name}</strong>
                          {student.email && <><br/><small className="text-muted">{student.email}</small></>}
                        </td>
                        <td>
                          <code>{student.sessionId?.substring(0, 12)}...</code>
                        </td>
                        <td>
                          {new Date(student.loginTime).toLocaleString()}
                        </td>
                        <td>
                          <Badge bg="success">
                            <i className="fas fa-circle me-1"></i>
                            Online
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent Publications */}
      <Row className="mb-4">
        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-success text-white">
              <h5 className="mb-0">
                <i className="fas fa-upload me-2"></i>
                Recent Publications
              </h5>
            </Card.Header>
            <Card.Body>
              {publicationLogs.length === 0 ? (
                <Alert variant="info" className="mb-0">
                  No quiz publications yet
                </Alert>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {publicationLogs.slice(-5).reverse().map((log, index) => (
                    <div key={index} className="border-bottom pb-2 mb-2">
                      <strong>{log.title}</strong>
                      <br/>
                      <small className="text-muted">
                        Published: {log.date} • Notified: {log.studentsNotified} students
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Student Activity Logs */}
        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-info text-white">
              <h5 className="mb-0">
                <i className="fas fa-activity me-2"></i>
                Student Activity
              </h5>
            </Card.Header>
            <Card.Body>
              {studentLogs.length === 0 ? (
                <Alert variant="info" className="mb-0">
                  No student activity yet
                </Alert>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {studentLogs.reverse().map((log, index) => (
                    <div key={index} className="border-bottom pb-2 mb-2">
                      <Badge 
                        bg={log.action === 'connected' ? 'success' : 'secondary'}
                        className="me-2"
                      >
                        {log.action}
                      </Badge>
                      Student ID: <code>{log.studentId.substring(0, 12)}...</code>
                      <br/>
                      <small className="text-muted">{log.date}</small>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default RealTimeDashboard;