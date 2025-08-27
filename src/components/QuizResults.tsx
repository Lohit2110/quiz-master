import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Badge, Table, Alert } from 'react-bootstrap';
import { QuizResult } from '../types';
import { QuizUtils, StorageUtils } from '../utils/storage';
import { PDFGenerator } from '../utils/pdfGenerator';
import './Quiz.css';

const QuizResults: React.FC = () => {
  const [results, setResults] = useState<QuizResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    const resultsData = sessionStorage.getItem('quiz_results');
    if (resultsData) {
      setResults(JSON.parse(resultsData));
    } else {
      // Redirect if no results found
      window.location.href = '/quiz-categories';
    }
  }, []);

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'success';
    if (percentage >= 60) return 'warning';
    return 'danger';
  };

  const getPerformanceMessage = (percentage: number) => {
    if (percentage >= 90) return '🎉 Excellent! Outstanding performance!';
    if (percentage >= 80) return '👏 Great job! Well done!';
    if (percentage >= 70) return '👍 Good work! Keep it up!';
    if (percentage >= 60) return '📚 Not bad! Room for improvement.';
    return '💪 Keep practicing! You\'ll do better next time.';
  };

  const handleRetakeQuiz = () => {
    sessionStorage.removeItem('quiz_results');
    window.location.href = `/quiz-categories`;
  };

  const handleNewCategory = () => {
    sessionStorage.removeItem('quiz_results');
    window.location.href = '/quiz-categories';
  };

  const generatePDFReport = async () => {
    if (!results) return;
    
    setIsGeneratingPDF(true);
    
    try {
      console.log('=== PDF GENERATION START ===');
      console.log('Results data:', results);
      
      // Get questions from detailed results or sessions
      let questionsWithAnswers: any[] = [];
      
      if (results.detailedResults && results.detailedResults.length > 0) {
        console.log('✅ Using detailed results from results object');
        // Results now include imageUrl and options directly!
        questionsWithAnswers = results.detailedResults.map(detail => ({
          id: detail.questionId,
          question: detail.question,
          options: detail.options || { a: 'Option A', b: 'Option B', c: 'Option C', d: 'Option D' },
          correctAnswer: detail.correctAnswer,
          category: 'general',
          imageUrl: detail.imageUrl || null,
          userAnswer: detail.userAnswer,
          isCorrect: detail.isCorrect
        }));
        console.log('🎯 Questions with proper image data:', questionsWithAnswers.length);
        // Verify image data is present
        const questionsWithImages = questionsWithAnswers.filter(q => q.imageUrl);
        console.log('🖼️ Questions with images found:', questionsWithImages.length);
        questionsWithImages.forEach((q, index) => {
          console.log(`  Image ${index + 1}: ${q.imageUrl?.substring(0, 50)}...`);
        });
      }
      
      // Try to get from sessions if not available in detailed results
      if (questionsWithAnswers.length === 0) {
        console.log('Trying to get from sessions...');
        const allSessions = StorageUtils.getSessions();
        console.log('📁 All sessions from storage:', allSessions);
        console.log('🔍 Looking for session ID:', results.sessionId);
        let targetSession = allSessions.find(s => s.id === results.sessionId);
        
        if (!targetSession) {
          targetSession = allSessions
            .filter(s => s.isCompleted && s.questions && s.questions.length > 0)
            .sort((a, b) => (b.endTime || b.startTime) - (a.endTime || a.startTime))[0];
        }
        
        console.log('Target session:', targetSession);
        
        if (targetSession && targetSession.questions && targetSession.questions.length > 0) {
          questionsWithAnswers = targetSession.questions.map((question: any) => {
            const userAnswer = targetSession!.answers && targetSession!.answers[question.id] ? targetSession!.answers[question.id] : 'Not answered';
            const isCorrect = userAnswer !== 'Not answered' && userAnswer === question.correctAnswer;
            
            return {
              ...question,
              userAnswer,
              isCorrect
            };
          });
          console.log('Questions from session:', questionsWithAnswers.length);
        }
      }
      
      // Final fallback: try to get questions from storage by category
      if (questionsWithAnswers.length === 0) {
        console.log('Trying to get questions by category...');
        const allQuestions = StorageUtils.getQuestions();
        console.log('📚 All questions from storage:', allQuestions.length);
        
        // Also try to get from saved quizzes
        const allSavedQuizzes = StorageUtils.getSavedQuizzes();
        console.log('💾 All saved quizzes:', allSavedQuizzes);
        console.log('🎯 Category name from results:', results.categoryName);
        
        // Try to find the saved quiz that was used
        const matchingSavedQuiz = allSavedQuizzes.find(quiz => 
          quiz.title === results.categoryName || 
          quiz.id === results.categoryName ||
          quiz.title.toLowerCase().includes(results.categoryName.toLowerCase())
        );
        
        console.log('🔍 Matching saved quiz:', matchingSavedQuiz);
        
        if (matchingSavedQuiz && matchingSavedQuiz.questions) {
          console.log('✅ Using questions from saved quiz');
          questionsWithAnswers = matchingSavedQuiz.questions.map(question => ({
            ...question,
            userAnswer: 'Not answered',
            isCorrect: false
          }));
          console.log('Questions from saved quiz:', questionsWithAnswers.length);
        } else {
          // Original category fallback
          const categoryQuestions = allQuestions.filter(q => q.category === results.categoryName.toLowerCase().replace(/\s+/g, '-'));
          
          if (categoryQuestions.length > 0) {
            questionsWithAnswers = categoryQuestions.slice(0, results.totalQuestions).map(question => ({
              ...question,
              userAnswer: 'Not answered',
              isCorrect: false
            }));
            console.log('Questions from category storage:', questionsWithAnswers.length);
          }
        }
      }
      
      console.log('=== FINAL PDF QUESTIONS DEBUG ===');
      console.log('Total questions for PDF:', questionsWithAnswers.length);
      if (questionsWithAnswers.length > 0) {
        console.log('Sample question data:', questionsWithAnswers[0]);
        console.log('Question text example:', questionsWithAnswers[0]?.question);
        console.log('Options example:', questionsWithAnswers[0]?.options);
        console.log('Image URL example:', questionsWithAnswers[0]?.imageUrl);
        console.log('Image URL type:', typeof questionsWithAnswers[0]?.imageUrl);
        console.log('Is data URL?', questionsWithAnswers[0]?.imageUrl?.startsWith('data:'));
        
        // Show all questions with images
        const questionsWithImages = questionsWithAnswers.filter(q => q.imageUrl);
        console.log('Questions with images:', questionsWithImages.length);
        questionsWithImages.forEach((q, index) => {
          console.log(`Question ${index + 1} image:`, {
            id: q.id,
            hasImage: !!q.imageUrl,
            imageType: q.imageUrl?.substring(0, 50) + '...',
            imageLength: q.imageUrl?.length
          });
        });
      }
      console.log('=== END PDF DEBUG ===');
      
      if (questionsWithAnswers.length === 0) {
        alert('No questions found for PDF generation. Please try taking the quiz again.');
        return;
      }
      
      // Create PDF generator and generate report
      const pdfGenerator = new PDFGenerator();
      await pdfGenerator.generateQuizReport(results, questionsWithAnswers);
      pdfGenerator.save(`Quiz-Results-${results.categoryName}-${new Date().toISOString().split('T')[0]}.pdf`);
      
      console.log('PDF generation completed successfully');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please check the console for details and try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (!results) {
    return (
      <Container className="py-5 text-center">
        <div>
          <i className="fas fa-spinner fa-spin fa-3x text-primary mb-3"></i>
          <h4>Loading Results...</h4>
        </div>
      </Container>
    );
  }

  const marksPercentage = results.maxMarks > 0 ? (results.totalMarks / results.maxMarks) * 100 : 0;
  const scoreColor = getScoreColor(marksPercentage);
  const performanceMessage = getPerformanceMessage(marksPercentage);

  return (
    <Container className="py-4">
      {/* Results Header */}
      <Row className="mb-4">
        <Col>
          <div className="text-center">
            <div className="mb-3">
              <i className={`fas fa-trophy fa-4x text-${scoreColor}`}></i>
            </div>
            <h1 className="display-4 fw-bold">Quiz Complete!</h1>
            <p className="lead text-muted">Here are your results for the quiz</p>
          </div>
        </Col>
      </Row>

      {/* Score Card */}
      <Row className="mb-4">
        <Col lg={8} className="mx-auto">
          <Card className="border-0 shadow-lg">
            <Card.Body className="p-4">
              <div className="text-center mb-4">
                <h2 className="fw-bold text-primary mb-2">{results.categoryName}</h2>
                <div className="mb-3">
                  <Badge bg={scoreColor} className="fs-1 p-3">
                    {results.totalMarks}/{results.maxMarks}
                  </Badge>
                  <div className="mt-2 text-muted">
                    <small>Total Marks</small>
                  </div>
                </div>
                <h5 className="text-muted mb-0">{performanceMessage}</h5>
              </div>

              <Row className="text-center g-3">
                <Col sm={6} lg={3}>
                  <div className="stat-item">
                    <div className="stat-number text-primary fw-bold fs-4">
                      {results.score}
                    </div>
                    <div className="stat-label text-muted">
                      <i className="fas fa-check-circle me-1"></i>
                      Correct (+{results.correctAnswers * 4})
                    </div>
                  </div>
                </Col>

                <Col sm={6} lg={3}>
                  <div className="stat-item">
                    <div className="stat-number text-danger fw-bold fs-4">
                      {results.incorrectAnswers}
                    </div>
                    <div className="stat-label text-muted">
                      <i className="fas fa-times-circle me-1"></i>
                      Wrong (-{results.incorrectAnswers})
                    </div>
                  </div>
                </Col>

                <Col sm={6} lg={3}>
                  <div className="stat-item">
                    <div className="stat-number text-warning fw-bold fs-4">
                      {results.skippedQuestions}
                    </div>
                    <div className="stat-label text-muted">
                      <i className="fas fa-minus-circle me-1"></i>
                      Skipped
                    </div>
                  </div>
                </Col>

                <Col sm={6} lg={3}>
                  <div className="stat-item">
                    <div className="stat-number text-info fw-bold fs-4">
                      {QuizUtils.formatTime(results.timeTaken)}
                    </div>
                    <div className="stat-label text-muted">
                      <i className="fas fa-clock me-1"></i>
                      Time Taken
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Action Buttons */}
      <Row className="mb-4">
        <Col className="text-center">
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            <Button
              variant="primary"
              size="lg"
              onClick={handleRetakeQuiz}
            >
              <i className="fas fa-redo me-2"></i>
              Retake Quiz
            </Button>

            <Button
              variant="outline-primary"
              size="lg"
              onClick={handleNewCategory}
            >
              <i className="fas fa-list me-2"></i>
              Try Different Category
            </Button>

            <Button
              variant="outline-secondary"
              size="lg"
              onClick={() => setShowDetails(!showDetails)}
            >
              <i className={`fas fa-${showDetails ? 'eye-slash' : 'eye'} me-2`}></i>
              {showDetails ? 'Hide' : 'Show'} Details
            </Button>

            <Button
              variant="outline-success"
              size="lg"
              onClick={generatePDFReport}
              disabled={isGeneratingPDF}
            >
              {isGeneratingPDF ? (
                <>
                  <i className="fas fa-spinner fa-spin me-2"></i>
                  Generating PDF...
                </>
              ) : (
                <>
                  <i className="fas fa-file-pdf me-2"></i>
                  Download PDF
                </>
              )}
            </Button>
          </div>
        </Col>
      </Row>

      {/* Detailed Results */}
      {showDetails && (
        <Row>
          <Col>
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-primary text-white">
                <h5 className="mb-0 fw-bold">
                  <i className="fas fa-list-alt me-2"></i>
                  Detailed Results
                </h5>
              </Card.Header>
              <Card.Body className="p-0">
                {results.detailedResults.length > 0 ? (
                  <Table responsive className="mb-0">
                    <thead className="bg-light">
                      <tr>
                        <th className="py-3">#</th>
                        <th className="py-3">Question</th>
                        <th className="py-3">Your Answer</th>
                        <th className="py-3">Correct Answer</th>
                        <th className="py-3">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.detailedResults.map((result, index) => (
                        <tr key={result.questionId}>
                          <td className="py-3 fw-bold">{index + 1}</td>
                          <td className="py-3">
                            <div className="max-width-300">
                              {result.question}
                            </div>
                          </td>
                          <td className="py-3">
                            {result.userAnswer === 'Not answered' ? (
                              <Badge bg="secondary">Not answered</Badge>
                            ) : (
                              <Badge bg="info">{result.userAnswer.toUpperCase()}</Badge>
                            )}
                          </td>
                          <td className="py-3">
                            <Badge bg="success">{result.correctAnswer.toUpperCase()}</Badge>
                          </td>
                          <td className="py-3">
                            {result.userAnswer === 'Not answered' ? (
                              <Badge bg="warning">
                                <i className="fas fa-minus me-1"></i>
                                Skipped
                              </Badge>
                            ) : result.isCorrect ? (
                              <Badge bg="success">
                                <i className="fas fa-check me-1"></i>
                                Correct
                              </Badge>
                            ) : (
                              <Badge bg="danger">
                                <i className="fas fa-times me-1"></i>
                                Incorrect
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <div className="p-4 text-center text-muted">
                    <i className="fas fa-exclamation-circle fa-2x mb-3"></i>
                    <p>No detailed results available</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Performance Analysis */}
      <Row className="mt-4">
        <Col lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-light">
              <h6 className="mb-0 fw-bold">
                <i className="fas fa-chart-pie me-2"></i>
                Performance Breakdown
              </h6>
            </Card.Header>
            <Card.Body>
              <div className="mb-3">
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-success">Correct Answers</span>
                  <span className="fw-bold">{results.correctAnswers}</span>
                </div>
                <div className="progress mb-2 custom-progress">
                  <div
                    className="progress-bar bg-success progress-fill"
                    style={{width: `${(results.correctAnswers / results.totalQuestions) * 100}%`}}
                  ></div>
                </div>
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-danger">Incorrect Answers</span>
                  <span className="fw-bold">{results.incorrectAnswers}</span>
                </div>
                <div className="progress mb-2 custom-progress">
                  <div
                    className="progress-bar bg-danger progress-fill"
                    style={{width: `${(results.incorrectAnswers / results.totalQuestions) * 100}%`}}
                  ></div>
                </div>
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-warning">Skipped Questions</span>
                  <span className="fw-bold">{results.skippedQuestions}</span>
                </div>
                <div className="progress custom-progress">
                  <div
                    className="progress-bar bg-warning progress-fill"
                    style={{width: `${(results.skippedQuestions / results.totalQuestions) * 100}%`}}
                  ></div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-light">
              <h6 className="mb-0 fw-bold">
                <i className="fas fa-lightbulb me-2"></i>
                Recommendations
              </h6>
            </Card.Header>
            <Card.Body>
              {results.percentage >= 80 ? (
                <Alert variant="success" className="mb-3">
                  <i className="fas fa-star me-2"></i>
                  Excellent performance! You have a strong understanding of this topic.
                </Alert>
              ) : results.percentage >= 60 ? (
                <Alert variant="warning" className="mb-3">
                  <i className="fas fa-book me-2"></i>
                  Good job! Consider reviewing the topics you missed to improve further.
                </Alert>
              ) : (
                <Alert variant="info" className="mb-3">
                  <i className="fas fa-study me-2"></i>
                  Keep practicing! Review the material and try again to improve your score.
                </Alert>
              )}

              <div className="small text-muted">
                <h6 className="fw-bold">Tips for improvement:</h6>
                <ul className="mb-0">
                  <li>Review questions you got wrong</li>
                  <li>Take your time reading each question</li>
                  <li>Practice with similar quizzes</li>
                  <li>Study the topic area more thoroughly</li>
                </ul>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default QuizResults;
