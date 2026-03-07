/**
 * StudentResults Component - Admin view for all student quiz results
 * 
 * This component displays all student quiz results using the StudentResultsService.
 * It provides real-time updates, filtering, sorting, and detailed result viewing.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Table, Button, Form, Badge, Modal, Alert, Spinner } from 'react-bootstrap';
import { QuizResult } from '../types';
import { StudentResultsService } from '../services/StudentResultsService';

const StudentResults: React.FC = () => {
  // State
  const [results, setResults] = useState<QuizResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<QuizResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter & Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState<'all' | 'student' | 'quiz'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'name' | 'quiz'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Modal State
  const [selectedResult, setSelectedResult] = useState<QuizResult | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  /**
   * Load results from Firebase and set up real-time listener
   */
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initializeResults = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // First, get all results
        console.log('📊 Loading student results...');
        const allResults = await StudentResultsService.getAllResults();
        setResults(allResults);
        console.log(`✅ Loaded ${allResults.length} results`);

        // Then set up real-time listener for updates
        console.log('🔄 Setting up real-time listener...');
        unsubscribe = StudentResultsService.subscribeToResults((updatedResults) => {
          console.log(`📡 Real-time update: ${updatedResults.length} results`);
          setResults(updatedResults);
        });

      } catch (err: any) {
        console.error('❌ Error loading results:', err);
        setError(err.message || 'Failed to load results');
        
        // Try to load cached results
        const cached = StudentResultsService.getCachedResults();
        if (cached.length > 0) {
          console.log(`📦 Using ${cached.length} cached results`);
          setResults(cached);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeResults();

    // Cleanup listener on unmount
    return () => {
      if (unsubscribe) {
        console.log('🧹 Cleaning up results listener');
        unsubscribe();
      }
    };
  }, []);

  /**
   * Apply filtering and sorting when results or filters change
   */
  useEffect(() => {
    let filtered = [...results];

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(result => {
        switch (filterBy) {
          case 'student':
            return (
              result.studentName.toLowerCase().includes(searchLower) ||
              (result.studentEmail && result.studentEmail.toLowerCase().includes(searchLower))
            );
          case 'quiz':
            return (
              result.quizTitle.toLowerCase().includes(searchLower) ||
              result.categoryName.toLowerCase().includes(searchLower)
            );
          default:
            return (
              result.studentName.toLowerCase().includes(searchLower) ||
              result.quizTitle.toLowerCase().includes(searchLower) ||
              result.categoryName.toLowerCase().includes(searchLower) ||
              (result.studentEmail && result.studentEmail.toLowerCase().includes(searchLower))
            );
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'date':
          compareValue = a.completedAt - b.completedAt;
          break;
        case 'score':
          compareValue = a.percentage - b.percentage;
          break;
        case 'name':
          compareValue = a.studentName.localeCompare(b.studentName);
          break;
        case 'quiz':
          compareValue = a.quizTitle.localeCompare(b.quizTitle);
          break;
      }

      return sortOrder === 'desc' ? -compareValue : compareValue;
    });

    setFilteredResults(filtered);
  }, [results, searchTerm, filterBy, sortBy, sortOrder]);

  /**
   * Manually refresh results from Firebase
   */
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 Force refreshing from Firebase...');
      const allResults = await StudentResultsService.getAllResults();
      setResults(allResults);
      console.log(`✅ Refreshed: ${allResults.length} results`);
    } catch (err: any) {
      console.error('❌ Refresh failed:', err);
      setError(err.message || 'Failed to refresh results');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Delete a single result
   */
  const handleDeleteResult = useCallback(async (sessionId: string) => {
    const resultToDelete = results.find(r => r.sessionId === sessionId);
    if (!resultToDelete) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${resultToDelete.studentName}'s result for "${resultToDelete.quizTitle}"?\n\nThis will be deleted from all devices.`
    );

    if (!confirmed) return;

    try {
      console.log(`🗑️ Deleting result: ${sessionId}`);
      const success = await StudentResultsService.deleteResult(sessionId);

      if (success) {
        console.log('✅ Result deleted successfully');
        // Results will update automatically via real-time listener
      } else {
        alert('⚠️ Failed to delete result. Please try again.');
      }
    } catch (err: any) {
      console.error('❌ Delete failed:', err);
      alert('❌ Error deleting result: ' + (err.message || 'Unknown error'));
    }
  }, [results]);

  /**
   * Delete all results
   */
  const handleClearAllResults = useCallback(async () => {
    const firstConfirm = window.confirm(
      '⚠️ DANGER: This will DELETE ALL student quiz results permanently from ALL DEVICES!\n\nAre you absolutely sure? This action CANNOT be undone.'
    );

    if (!firstConfirm) return;

    const doubleCheck = window.prompt('Type "DELETE ALL" to confirm this action:');
    if (doubleCheck !== 'DELETE ALL') {
      alert('Action cancelled. No results were deleted.');
      return;
    }

    try {
      console.log('🗑️ Clearing all results...');
      const { success, deletedCount } = await StudentResultsService.deleteAllResults();

      if (success) {
        console.log(`✅ Deleted ${deletedCount} results`);
        alert(`✅ Successfully deleted ${deletedCount} results from all devices!`);
      } else {
        alert('⚠️ Failed to clear results. Some results may remain.');
      }
    } catch (err: any) {
      console.error('❌ Clear all failed:', err);
      alert('❌ Error clearing results: ' + (err.message || 'Unknown error'));
    }
  }, []);

  /**
   * Reset all filters
   */
  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterBy('all');
    setSortBy('date');
    setSortOrder('desc');
  }, []);

  /**
   * View result details
   */
  const handleViewDetails = useCallback((result: QuizResult) => {
    setSelectedResult(result);
    setShowDetailModal(true);
  }, []);

  // Helper functions
  const getScoreColor = (percentage: number): string => {
    if (percentage >= 80) return 'success';
    if (percentage >= 60) return 'warning';
    return 'danger';
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  // Render
  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm">
            <Card.Header className="bg-primary text-white">
              <h4 className="mb-0">
                <i className="fas fa-chart-line me-2"></i>
                Student Quiz Results
              </h4>
            </Card.Header>
            <Card.Body>
              {/* Error Alert */}
              {error && (
                <Alert variant="danger" dismissible onClose={() => setError(null)}>
                  <i className="fas fa-exclamation-circle me-2"></i>
                  {error}
                </Alert>
              )}

              {/* Filter Controls */}
              <Row className="mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Search</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Search students, quizzes..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Filter By</Form.Label>
                    <Form.Select
                      value={filterBy}
                      onChange={(e) => setFilterBy(e.target.value as 'all' | 'student' | 'quiz')}
                    >
                      <option value="all">All</option>
                      <option value="student">Student</option>
                      <option value="quiz">Quiz</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Sort By</Form.Label>
                    <Form.Select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'date' | 'score' | 'name' | 'quiz')}
                    >
                      <option value="date">Date</option>
                      <option value="score">Score</option>
                      <option value="name">Student Name</option>
                      <option value="quiz">Quiz Title</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Order</Form.Label>
                    <Form.Select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                    >
                      <option value="desc">Descending</option>
                      <option value="asc">Ascending</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2} className="d-flex align-items-end">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={handleClearFilters}
                    title="Reset search and filters"
                    className="w-100"
                  >
                    <i className="fas fa-redo me-1"></i>
                    Reset
                  </Button>
                </Col>
              </Row>

              {/* Stats and Actions Bar */}
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <div>
                  <Badge bg="info" className="me-2">
                    Total Results: {results.length}
                  </Badge>
                  <Badge bg="secondary">
                    Showing: {filteredResults.length}
                  </Badge>
                </div>
                <div className="d-flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isLoading}
                    title="Refresh from Firebase"
                  >
                    {isLoading ? (
                      <Spinner animation="border" size="sm" className="me-1" />
                    ) : (
                      <i className="fas fa-sync-alt me-1"></i>
                    )}
                    Refresh
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleClearAllResults}
                    disabled={results.length === 0 || isLoading}
                    title="Delete ALL results"
                  >
                    <i className="fas fa-trash-alt me-1"></i>
                    Delete All
                  </Button>
                </div>
              </div>

              {/* Results Table or Loading/Empty State */}
              {isLoading && results.length === 0 ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" className="mb-3" />
                  <p>Loading student results...</p>
                </div>
              ) : filteredResults.length === 0 ? (
                <Alert variant="info" className="text-center">
                  <i className="fas fa-info-circle me-2"></i>
                  {results.length === 0
                    ? 'No student results found. Results will appear here when students complete quizzes.'
                    : 'No results match your search criteria.'}
                </Alert>
              ) : (
                <div className="table-responsive">
                  <Table striped bordered hover className="student-results-table">
                    <thead>
                      <tr>
                        <th>Student Name</th>
                        <th>Quiz Title</th>
                        <th>Marks</th>
                        <th>Percentage</th>
                        <th>Time Taken</th>
                        <th>Completed At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((result) => (
                        <tr key={result.sessionId}>
                          <td>
                            <strong>{result.studentName}</strong>
                            {result.studentEmail && (
                              <div className="text-muted small">{result.studentEmail}</div>
                            )}
                          </td>
                          <td>
                            <div>{result.quizTitle}</div>
                            <small className="text-muted">{result.categoryName}</small>
                          </td>
                          <td>
                            <Badge bg={getScoreColor(result.percentage)}>
                              {result.totalMarks}/{result.maxMarks}
                            </Badge>
                          </td>
                          <td>
                            <Badge bg={getScoreColor(result.percentage)}>
                              {result.percentage}%
                            </Badge>
                          </td>
                          <td>{formatTime(result.timeTaken)}</td>
                          <td>
                            <small>{formatDate(result.completedAt)}</small>
                          </td>
                          <td>
                            <Button
                              size="sm"
                              variant="outline-primary"
                              className="me-1"
                              onClick={() => handleViewDetails(result)}
                              title="View Details"
                            >
                              <i className="fas fa-eye"></i>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => handleDeleteResult(result.sessionId)}
                              title="Delete"
                            >
                              <i className="fas fa-trash"></i>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Detail Modal */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-chart-bar me-2"></i>
            Detailed Results: {selectedResult?.studentName}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedResult && (
            <>
              <Row className="mb-4">
                <Col md={6}>
                  <Card>
                    <Card.Header>
                      <h6 className="mb-0">Student Information</h6>
                    </Card.Header>
                    <Card.Body>
                      <p><strong>Name:</strong> {selectedResult.studentName}</p>
                      {selectedResult.studentEmail && (
                        <p><strong>Email:</strong> {selectedResult.studentEmail}</p>
                      )}
                      <p><strong>Quiz:</strong> {selectedResult.quizTitle}</p>
                      <p><strong>Category:</strong> {selectedResult.categoryName}</p>
                      <p><strong>Completed:</strong> {formatDate(selectedResult.completedAt)}</p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card>
                    <Card.Header>
                      <h6 className="mb-0">Performance Summary</h6>
                    </Card.Header>
                    <Card.Body>
                      <p><strong>Total Questions:</strong> {selectedResult.totalQuestions}</p>
                      <p><strong>Correct Answers:</strong> {selectedResult.correctAnswers}</p>
                      <p><strong>Incorrect Answers:</strong> {selectedResult.incorrectAnswers}</p>
                      <p><strong>Skipped Questions:</strong> {selectedResult.skippedQuestions}</p>
                      <p>
                        <strong>Marks:</strong>{' '}
                        <Badge bg={getScoreColor(selectedResult.percentage)}>
                          {selectedResult.totalMarks}/{selectedResult.maxMarks}
                        </Badge>
                      </p>
                      <p>
                        <strong>Percentage:</strong>{' '}
                        <Badge bg={getScoreColor(selectedResult.percentage)}>
                          {selectedResult.percentage}%
                        </Badge>
                      </p>
                      <p><strong>Time Taken:</strong> {formatTime(selectedResult.timeTaken)}</p>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Question-wise Details */}
              {selectedResult.detailedResults && selectedResult.detailedResults.length > 0 && (
                <Card>
                  <Card.Header>
                    <h6 className="mb-0">Question-wise Details</h6>
                  </Card.Header>
                  <Card.Body>
                    <div className="table-responsive">
                      <Table size="sm" striped>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Question</th>
                            <th>Student Answer</th>
                            <th>Correct Answer</th>
                            <th>Result</th>
                            <th>Marks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedResult.detailedResults.map((detail, index) => (
                            <tr key={detail.questionId}>
                              <td>{index + 1}</td>
                              <td>
                                <div className="small">
                                  {detail.question}
                                  {detail.imageUrl && (
                                    <div className="mt-1">
                                      <img
                                        src={detail.imageUrl}
                                        alt="Question"
                                        className="detail-question-image rounded"
                                        style={{ maxHeight: '100px' }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span className={detail.isCorrect ? 'text-success' : 'text-danger'}>
                                  {detail.userAnswer === 'Not answered'
                                    ? 'Not answered'
                                    : detail.options?.[detail.userAnswer as keyof typeof detail.options] || detail.userAnswer}
                                </span>
                              </td>
                              <td>
                                <span className="text-success">
                                  {detail.options?.[detail.correctAnswer as keyof typeof detail.options] || detail.correctAnswer}
                                </span>
                              </td>
                              <td>
                                {detail.userAnswer === 'Not answered' ? (
                                  <Badge bg="secondary">Skipped</Badge>
                                ) : detail.isCorrect ? (
                                  <Badge bg="success">Correct</Badge>
                                ) : (
                                  <Badge bg="danger">Incorrect</Badge>
                                )}
                              </td>
                              <td>
                                <Badge
                                  bg={
                                    detail.marksAwarded > 0
                                      ? 'success'
                                      : detail.marksAwarded < 0
                                      ? 'danger'
                                      : 'secondary'
                                  }
                                >
                                  {detail.marksAwarded > 0 ? '+' : ''}
                                  {detail.marksAwarded}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </Card.Body>
                </Card>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default StudentResults;
