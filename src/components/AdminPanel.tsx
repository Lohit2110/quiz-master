import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Modal, Form, Alert, Badge, InputGroup, Nav, Tab } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { QuizQuestion, QuizCategory, SavedQuiz } from '../types';
import { StorageUtils, QuizUtils, ImageUtils } from '../utils/storage';
import StudentResults from './StudentResults';
import RealTimeDashboard from './RealTimeDashboard';
import { cloudSync } from '../services/CloudSyncService';
import QuizBackupService from '../services/QuizBackupService';
import { useQuizContext } from '../contexts/QuizContext';
import { realOTPService } from '../services/RealOTPService';

const AdminPanel: React.FC = () => {
  return <AdminPanelContent />;
};

const AdminPanelContent: React.FC = () => {
  const navigate = useNavigate();
  const { quizzes: savedQuizzes, setQuizzes: setSavedQuizzes, refreshQuizzes } = useQuizContext();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<QuizQuestion[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Edit states
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [deleteQuestionId, setDeleteQuestionId] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [alertState, setAlertState] = useState<{ type: 'success' | 'danger', message: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    StorageUtils.safeInitialize();
    loadData();

    // QuizContext handles Firebase real-time sync automatically
    console.log('📊 Admin: QuizContext managing Firebase sync');

    // Trigger initial refresh from QuizContext
    refreshQuizzes().catch((error) => {
      console.error('⚠️ Admin: Failed to refresh quizzes:', error);
    });
  }, []);

  useEffect(() => {
    filterQuestions();
  }, [questions, selectedCategory, searchTerm]);

  const loadData = () => {
    const loadedQuestions = StorageUtils.getQuestions();
    const loadedCategories = StorageUtils.getCategories();
    setQuestions(loadedQuestions);
    setCategories(loadedCategories);
  };

  const filterQuestions = () => {
    let filtered = questions;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(q => q.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(q =>
        q.question.toLowerCase().includes(term) ||
        Object.values(q.options).some(option =>
          option.toLowerCase().includes(term)
        )
      );
    }

    setFilteredQuestions(filtered);
  };

  const handleEditQuestion = (question: QuizQuestion) => {
    setEditingQuestion({ ...question });
    setShowEditModal(true);
  };

  const handleDeleteQuestion = (questionId: string) => {
    setDeleteQuestionId(questionId);
    setShowDeleteModal(true);
  };

  const confirmDeleteQuestion = () => {
    if (deleteQuestionId) {
      StorageUtils.deleteQuestion(deleteQuestionId);
      loadData();
      setShowDeleteModal(false);
      setDeleteQuestionId('');
      showSuccessMessage('Question deleted successfully!');
    }
  };

  const saveEditedQuestion = () => {
    if (!editingQuestion) return;

    // Validation
    if (!editingQuestion.question.trim()) {
      showErrorMessage('Please enter a question');
      return;
    }

    if (!editingQuestion.options.a.trim() || !editingQuestion.options.b.trim() ||
      !editingQuestion.options.c.trim() || !editingQuestion.options.d.trim()) {
      showErrorMessage('Please fill in all answer options');
      return;
    }

    if (!editingQuestion.category) {
      showErrorMessage('Please select a category');
      return;
    }

    StorageUtils.updateQuestion(editingQuestion);
    loadData();
    setShowEditModal(false);
    setEditingQuestion(null);
    showSuccessMessage('Question updated successfully!');
  };

  const handleImageUpload = async (file: File) => {
    if (!editingQuestion) return;

    try {
      // INSTANT: Create and show preview immediately (< 100ms)
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && editingQuestion) {
          setEditingQuestion({ ...editingQuestion, imageUrl: e.target.result as string });
          showSuccessMessage('✅ Image loaded! Uploading in background...');
        }
      };
      reader.readAsDataURL(file);

      // BACKGROUND: Upload to Cloudinary without blocking
      setIsUploading(true);
      ImageUtils.handleFileUpload(file).then((cloudinaryUrl) => {
        if (editingQuestion) {
          setEditingQuestion({ ...editingQuestion, imageUrl: cloudinaryUrl });
          showSuccessMessage('✅ Image uploaded to cloud!');
        }
        setIsUploading(false);
      }).catch((error) => {
        console.warn('Upload to Cloudinary failed, keeping local preview');
        setIsUploading(false);
      });

    } catch (error) {
      showErrorMessage(error instanceof Error ? error.message : 'Failed to upload image');
      setIsUploading(false);
    }
  };

  const handleImagePaste = async (event: React.ClipboardEvent) => {
    if (!editingQuestion) return;

    event.preventDefault();
    setIsUploading(true);
    try {
      const { previewUrl, uploadPromise } = await ImageUtils.handleClipboardPaste(event.nativeEvent as ClipboardEvent);

      // ⚡ INSTANT: show high-quality preview immediately
      setEditingQuestion({ ...editingQuestion, imageUrl: previewUrl });
      showSuccessMessage('✅ Image pasted! Uploading to cloud in background...');
      setIsUploading(false);

      // ☁️ BACKGROUND: swap with Cloudinary URL silently
      uploadPromise.then((cloudUrl) => {
        if (cloudUrl !== previewUrl) {
          setEditingQuestion(prev => prev ? { ...prev, imageUrl: cloudUrl } : prev);
          console.log('✅ Preview swapped with Cloudinary URL');
        }
      });

    } catch (error) {
      showErrorMessage(error instanceof Error ? error.message : 'Failed to paste image');
      setIsUploading(false);
    }
  };

  const createNewCategory = () => {
    if (!newCategoryName.trim()) {
      showErrorMessage('Please enter a category name');
      return;
    }

    const categoryId = newCategoryName.toLowerCase().replace(/\s+/g, '-');

    if (categories.find(cat => cat.id === categoryId)) {
      showErrorMessage('Category already exists');
      return;
    }

    const newCategory: QuizCategory = {
      id: categoryId,
      name: newCategoryName.trim(),
      description: `Questions about ${newCategoryName.trim()}`,
      questionCount: 0
    };

    StorageUtils.addCategory(newCategory);
    setNewCategoryName('');
    setShowCategoryModal(false);
    loadData();
    showSuccessMessage('Category created successfully!');
  };

  const deleteCategory = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    const questionsInCategory = questions.filter(q => q.category === categoryId).length;

    if (questionsInCategory > 0) {
      if (!window.confirm(`This will delete the category "${category.name}" and all ${questionsInCategory} questions in it. Are you sure?`)) {
        return;
      }
    }

    StorageUtils.deleteCategory(categoryId);
    loadData();
    showSuccessMessage('Category deleted successfully!');
  };

  const exportData = () => {
    const data = {
      questions: StorageUtils.getQuestions(),
      categories: StorageUtils.getCategories(),
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const showSuccessMessage = (message: string) => {
    setAlertState({ type: 'success', message });
    setTimeout(() => setAlertState(null), 5000);
  };

  const showErrorMessage = (message: string) => {
    setAlertState({ type: 'danger', message });
    setTimeout(() => setAlertState(null), 5000);
  };

  const restoreTestQuiz = () => {
    // Create a comprehensive "TEST 2" quiz with 40 questions
    const baseTime = Date.now();
    const questions = [];

    // Generate 40 diverse questions
    const questionTemplates = [
      { q: 'What is the capital of France?', a: 'London', b: 'Berlin', c: 'Paris', d: 'Madrid', correct: 'c' },
      { q: 'Which planet is known as the Red Planet?', a: 'Earth', b: 'Mars', c: 'Jupiter', d: 'Venus', correct: 'b' },
      { q: 'What is 2 + 2?', a: '3', b: '4', c: '5', d: '6', correct: 'b' },
      { q: 'Who painted the Mona Lisa?', a: 'Van Gogh', b: 'Picasso', c: 'Da Vinci', d: 'Monet', correct: 'c' },
      { q: 'What is the largest ocean?', a: 'Atlantic', b: 'Indian', c: 'Arctic', d: 'Pacific', correct: 'd' },
      { q: 'In which year did World War II end?', a: '1944', b: '1945', c: '1946', d: '1947', correct: 'b' },
      { q: 'What is the chemical symbol for gold?', a: 'Go', b: 'Gd', c: 'Au', d: 'Ag', correct: 'c' },
      { q: 'Which is the smallest country in the world?', a: 'Monaco', b: 'Vatican City', c: 'San Marino', d: 'Liechtenstein', correct: 'b' },
      { q: 'What is the square root of 64?', a: '6', b: '7', c: '8', d: '9', correct: 'c' },
      { q: 'Who wrote "Romeo and Juliet"?', a: 'Charles Dickens', b: 'William Shakespeare', c: 'Jane Austen', d: 'Mark Twain', correct: 'b' }
    ];

    // Create 40 questions by cycling through templates and adding variations
    for (let i = 0; i < 40; i++) {
      const template = questionTemplates[i % questionTemplates.length];
      const questionNumber = i + 1;

      questions.push({
        id: `test2-q${questionNumber}-${baseTime + i}`,
        question: `Question ${questionNumber}: ${template.q}`,
        options: {
          a: template.a,
          b: template.b,
          c: template.c,
          d: template.d
        },
        correctAnswer: template.correct as 'a' | 'b' | 'c' | 'd',
        category: 'general'
      });
    }

    const testQuiz = {
      id: 'test-2-' + baseTime,
      title: 'TEST 2',
      description: `Comprehensive TEST 2 quiz with ${questions.length} questions`,
      category: 'general',
      questions: questions,
      createdAt: baseTime
    };

    // Save the quiz
    StorageUtils.addSavedQuiz(testQuiz);

    // Also add the questions to the main questions pool
    testQuiz.questions.forEach(question => {
      StorageUtils.addQuestion(question);
    });

    loadData();
    showSuccessMessage(`TEST 2 quiz has been restored successfully with ${questions.length} questions!`);
  };

  const copyQuiz = async (quiz: any) => {
    if (window.confirm(`Create a copy of "${quiz.title}"? The copy will be saved as a draft.`)) {
      try {
        console.log('📋 Copying quiz:', quiz.title);

        // Generate new ID and timestamp
        const newQuizId = `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = Date.now();

        // Create copy with new properties
        const copiedQuiz = {
          ...quiz,
          id: newQuizId,
          title: `${quiz.title} (Copy)`,
          published: false, // Always start as draft
          createdAt: now,
          lastModified: now,
          publishedAt: undefined,
          publishedBy: undefined
        };

        // Import EnhancedCloudSync
        const { EnhancedCloudSync } = await import('../services/EnhancedCloudSync');

        // Save copy to Firebase
        const success = await EnhancedCloudSync.saveQuizUnlimited(copiedQuiz);

        if (success) {
          showSuccessMessage(`✅ Quiz copied successfully as "${copiedQuiz.title}"!`);
          // Refresh to show new copy
          await refreshQuizzes();
        } else {
          showErrorMessage('Failed to copy quiz. Please try again.');
        }
      } catch (error) {
        console.error('❌ Error copying quiz:', error);
        showErrorMessage('Failed to copy quiz. Please try again.');
      }
    }
  };

  const togglePublishQuiz = async (quizId: string, quizTitle: string, currentPublishState: boolean) => {
    const action = currentPublishState ? 'unpublish' : 'publish';
    const confirmMessage = currentPublishState
      ? `Unpublish "${quizTitle}"? Students won't be able to see or take this quiz. Original question order will be restored.`
      : `Publish "${quizTitle}"? Questions will be shuffled for students. Your admin view will keep the original order.`;

    if (window.confirm(confirmMessage)) {
      try {
        console.log(`📢 ${action}ing quiz:`, quizTitle, 'ID:', quizId);

        const result = await cloudSync.togglePublishStatus(quizId, !currentPublishState);

        if (result.success) {
          showSuccessMessage(`✅ Quiz "${quizTitle}" ${action}ed successfully!`);
          // Refresh quizzes to update UI
          await refreshQuizzes();
        } else {
          showErrorMessage(result.message);
        }
      } catch (error) {
        console.error(`❌ Error ${action}ing quiz:`, error);
        showErrorMessage(`Failed to ${action} quiz. Please try again.`);
      }
    }
  };

  const deleteSavedQuiz = async (quizId: string, quizTitle: string) => {
    if (window.confirm(`Are you sure you want to delete the quiz "${quizTitle}"? This action cannot be undone and will remove it from admin panel too.`)) {
      try {
        console.log('🗑️ Deleting quiz:', quizTitle, 'ID:', quizId);

        // 1. Delete from Firebase first
        try {
          await cloudSync.deleteQuizFromCloud(quizId);
          console.log('✅ Quiz deleted from Firebase');
        } catch (firebaseError) {
          console.error('⚠️ Firebase deletion failed:', firebaseError);
          // Continue with local deletion even if Firebase fails
        }

        // 2. Delete from state (quizzes are managed by QuizContext)
        const updatedQuizzes = savedQuizzes.filter(quiz => quiz.id !== quizId);
        setSavedQuizzes(updatedQuizzes);
        console.log('✅ Quiz deleted from state');

        // 3. Reload data to refresh the UI
        loadData();

        showSuccessMessage(`Quiz "${quizTitle}" has been permanently deleted!`);
      } catch (error) {
        console.error('❌ Error deleting quiz:', error);
        showErrorMessage('Failed to delete quiz. Please try again.');
      }
    }
  };

  const getQuestionCountByCategory = (categoryId: string): number => {
    return questions.filter(q => q.category === categoryId).length;
  };

  return (
    <Container className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <h1 className="display-5 fw-bold text-center">
            <i className="fas fa-cog me-3"></i>
            Admin Panel
          </h1>
          <p className="lead text-center text-muted">
            Manage questions, categories, and view student results
          </p>
        </Col>
      </Row>

      {/* Tabs */}
      <Tab.Container defaultActiveKey="questions">
        <style>{`
          .custom-nav-pills .nav-link {
            background-color: #e9ecef !important;
            color: #495057 !important;
            border: 1px solid #dee2e6 !important;
          }
          .custom-nav-pills .nav-link:hover {
            background-color: #dee2e6 !important;
            color: #212529 !important;
          }
          .custom-nav-pills .nav-link.active {
            background-color: #0d6efd !important;
            color: white !important;
            border-color: #0d6efd !important;
          }
        `}</style>
        <Nav variant="pills" className="mb-4 p-3 rounded custom-nav-pills" style={{ backgroundColor: '#f8f9fa', gap: '10px', display: 'flex' }}>
          <Nav.Item>
            <Nav.Link
              eventKey="questions"
              className="fw-bold px-4 py-2"
            >
              <i className="fas fa-question-circle me-2"></i>
              Question Management
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey="real-time"
              className="fw-bold px-4 py-2"
            >
              <i className="fas fa-broadcast-tower me-2"></i>
              Real-Time Dashboard
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey="student-results"
              className="fw-bold px-4 py-2"
            >
              <i className="fas fa-chart-line me-2"></i>
              Student Results
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey="registered-students"
              className="fw-bold px-4 py-2"
            >
              <i className="fas fa-users me-2"></i>
              Registered Students
            </Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          <Tab.Pane eventKey="questions">
            {/* Existing admin panel content */}

            {alertState && (
              <Alert variant={alertState.type} dismissible onClose={() => setAlertState(null)}>
                {alertState.message}
              </Alert>
            )}

            {/* Controls */}
            <Row className="mb-4">
              <Col>
                <Card className="border-0 shadow-sm">
                  <Card.Body>
                    <Row className="g-3 align-items-end">
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label className="fw-bold">Filter by Category</Form.Label>
                          <Form.Select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                          >
                            <option value="all">All Categories</option>
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name} ({getQuestionCountByCategory(cat.id)})
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>

                      <Col md={4}>
                        <Form.Group>
                          <Form.Label className="fw-bold">Search Questions</Form.Label>
                          <InputGroup>
                            <Form.Control
                              type="text"
                              placeholder="Search questions..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <Button variant="outline-secondary">
                              <i className="fas fa-search"></i>
                            </Button>
                          </InputGroup>
                        </Form.Group>
                      </Col>

                      <Col md={4}>
                        <div className="d-flex gap-2">
                          <Button
                            variant="primary"
                            onClick={() => setShowCategoryModal(true)}
                          >
                            <i className="fas fa-plus me-2"></i>
                            Add Category
                          </Button>
                          <Button
                            variant="outline-secondary"
                            onClick={exportData}
                          >
                            <i className="fas fa-download me-2"></i>
                            Export
                          </Button>
                        </div>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Storage Management */}
            <Row className="mb-4">
              <Col>
                <Card className="border-0 shadow-sm">
                  <Card.Header className="bg-light">
                    <h5 className="mb-0 fw-bold">
                      <i className="fas fa-database me-2"></i>
                      Storage Management
                    </h5>
                  </Card.Header>
                  <Card.Body>
                    <Row className="g-3">
                      <Col md={6}>
                        <h6 className="fw-bold text-primary">Storage Status</h6>
                        <p className="text-muted mb-2">
                          <i className="fas fa-info-circle me-2"></i>
                          Manage browser storage and recover lost data
                        </p>
                        <div className="d-flex gap-2 flex-wrap">
                          <Button
                            variant="info"
                            size="sm"
                            onClick={() => {
                              const questions = StorageUtils.getQuestions();
                              const categories = StorageUtils.getCategories();
                              const sessions = StorageUtils.getSessions();
                              window.alert(`Storage Status:
Saved Quizzes: ${savedQuizzes.length}
Questions: ${questions.length}
Categories: ${categories.length}
Sessions: ${sessions.length}`);
                            }}
                          >
                            <i className="fas fa-chart-bar me-1"></i>
                            Check Data
                          </Button>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => {
                              try {
                                StorageUtils.safeInitialize();
                                loadData();
                                setAlertState({ type: 'success', message: 'Data recovered successfully!' });
                              } catch (error) {
                                setAlertState({ type: 'danger', message: 'Failed to recover data.' });
                              }
                            }}
                          >
                            <i className="fas fa-first-aid me-1"></i>
                            Recover Data
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={restoreTestQuiz}
                          >
                            <i className="fas fa-undo me-1"></i>
                            Restore TEST 2
                          </Button>
                        </div>
                      </Col>
                      <Col md={6}>
                        <h6 className="fw-bold text-warning">Cleanup Options</h6>
                        <p className="text-muted mb-2">
                          <i className="fas fa-broom me-2"></i>
                          Clean old sessions without losing your created quizzes
                        </p>
                        <div className="d-flex gap-2 flex-wrap">
                          <Button
                            variant="warning"
                            size="sm"
                            onClick={() => {
                              try {
                                // Manual cleanup that preserves user data
                                const sessions = StorageUtils.getSessions();
                                const oldCount = sessions.length;

                                // Keep only last 5 sessions
                                sessions.sort((a, b) => b.startTime - a.startTime);
                                const cleanSessions = sessions.slice(0, 5);
                                localStorage.setItem('quiz_master_sessions', JSON.stringify(cleanSessions));

                                setAlertState({ type: 'success', message: `Cleaned up ${oldCount - cleanSessions.length} old sessions. Your quizzes are safe!` });
                              } catch (error) {
                                setAlertState({ type: 'danger', message: 'Cleanup failed.' });
                              }
                            }}
                          >
                            <i className="fas fa-broom me-1"></i>
                            Clean Sessions
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => {
                              if (window.confirm('⚠️ WARNING: This will delete ALL your created quizzes and questions! This cannot be undone. Are you absolutely sure?')) {
                                if (window.confirm('FINAL WARNING: You will lose all your work. Type "DELETE ALL" in the next prompt to confirm.')) {
                                  const confirmation = prompt('Type "DELETE ALL" to confirm:');
                                  if (confirmation === 'DELETE ALL') {
                                    localStorage.clear();
                                    window.location.reload();
                                  } else {
                                    window.alert('Cancelled - no data was deleted.');
                                  }
                                }
                              }
                            }}
                          >
                            <i className="fas fa-trash me-1"></i>
                            Delete Everything
                          </Button>
                        </div>
                      </Col>
                    </Row>

                    {/* Current Saved Quizzes Status */}
                    <hr />
                    <Row>
                      <Col>
                        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                          <h6 className="fw-bold text-success mb-0">Your Saved Quizzes</h6>
                          <div className="d-flex gap-2 flex-wrap">
                            {/* Import Quiz Button */}
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '.json';
                                input.onchange = async (e: any) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const importedQuizzes = await QuizBackupService.importBackup(file);
                                    if (importedQuizzes.length > 0) {
                                      // Save imported quizzes to state (QuizContext manages persistence)
                                      const updatedQuizzes = [...savedQuizzes, ...importedQuizzes];
                                      setSavedQuizzes(updatedQuizzes);
                                      loadData();
                                      showSuccessMessage(`Successfully imported ${importedQuizzes.length} quiz(es)!`);
                                    }
                                  }
                                };
                                input.click();
                              }}
                            >
                              <i className="fas fa-file-import me-1"></i>
                              Import
                            </Button>

                            {/* Export All Button */}
                            {savedQuizzes.length > 0 && (
                              <Button
                                variant="outline-success"
                                size="sm"
                                onClick={() => {
                                  QuizBackupService.exportAllQuizzes(savedQuizzes);
                                }}
                              >
                                <i className="fas fa-file-export me-1"></i>
                                Export All
                              </Button>
                            )}

                            {/* Delete All Button */}
                            {savedQuizzes.length > 0 && (
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete ALL ${savedQuizzes.length} saved quizzes? This action cannot be undone.`)) {
                                    localStorage.removeItem('quiz_master_saved_quizzes');
                                    loadData();
                                    showSuccessMessage('All saved quizzes have been deleted.');
                                  }
                                }}
                              >
                                <i className="fas fa-trash me-1"></i>
                                Delete All
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="text-muted">
                          {savedQuizzes.length === 0 ? (
                            <p className="mb-0">
                              <i className="fas fa-exclamation-triangle text-warning me-2"></i>
                              No saved quizzes found. Click "Recover Data" above to restore default content, or create new quizzes in the Create Quiz section.
                            </p>
                          ) : (
                            <div>
                              <p className="mb-3">
                                <i className="fas fa-check-circle text-success me-2"></i>
                                Found {savedQuizzes.length} saved quiz(s)
                              </p>
                              <Row className="g-2">
                                {savedQuizzes.map(quiz => (
                                  <Col md={6} lg={4} key={quiz.id}>
                                    <Card className="border h-100 shadow-sm">
                                      <Card.Body className="d-flex flex-column">
                                        <div className="flex-grow-1">
                                          <h6 className="fw-bold text-primary mb-2">
                                            <i className="fas fa-quiz me-2"></i>
                                            {quiz.title}
                                          </h6>
                                          <p className="text-muted small mb-2">
                                            {quiz.description || 'No description available'}
                                          </p>
                                          <div className="d-flex align-items-center text-muted small">
                                            <Badge bg="secondary" className="me-2">
                                              {quiz.questions.length} questions
                                            </Badge>
                                            <Badge bg="info" className="me-2">
                                              {(() => {
                                                const uniqueCategories = Array.from(new Set(quiz.questions.map((q: QuizQuestion) => q.category)));
                                                if (uniqueCategories.length === 1) {
                                                  const categoryName = categories.find((c: QuizCategory) => c.id === uniqueCategories[0])?.name || uniqueCategories[0];
                                                  return categoryName;
                                                } else {
                                                  return `${uniqueCategories.length} categories`;
                                                }
                                              })() as string}
                                            </Badge>
                                            <Badge bg={quiz.published ? "success" : "warning"}>
                                              {quiz.published ? "Published" : "Draft"}
                                            </Badge>
                                          </div>
                                          {(quiz.subject || (quiz.chapters && quiz.chapters.length > 0)) && (
                                            <div className="mt-2">
                                              {quiz.subject && (
                                                <small className="text-muted d-block">
                                                  <i className="fas fa-book me-1 text-primary"></i>
                                                  <strong>{quiz.subject}</strong>
                                                </small>
                                              )}
                                              {quiz.chapters && quiz.chapters.length > 0 && (
                                                <div className="mt-1 d-flex flex-wrap gap-1">
                                                  {quiz.chapters.map((ch: string, idx: number) => (
                                                    <span
                                                      key={idx}
                                                      className="badge"
                                                      style={{ backgroundColor: '#e8f4fd', color: '#0d6efd', fontSize: '0.7rem', fontWeight: 500 }}
                                                    >
                                                      {ch}
                                                    </span>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        <div className="mt-3 d-flex gap-1 flex-wrap">
                                          <Button
                                            variant={quiz.published ? "warning" : "success"}
                                            size="sm"
                                            title={quiz.published ? "Unpublish - hide from students" : "Publish - show to students"}
                                            onClick={() => togglePublishQuiz(quiz.id, quiz.title, quiz.published || false)}
                                          >
                                            <i className={`fas fa-${quiz.published ? 'eye-slash' : 'upload'} me-1`}></i>
                                            {quiz.published ? 'Unpublish' : 'Publish'}
                                          </Button>
                                          <Button
                                            variant="outline-success"
                                            size="sm"
                                            title="Export this quiz"
                                            onClick={() => {
                                              QuizBackupService.exportQuiz(quiz);
                                              showSuccessMessage(`Quiz "${quiz.title}" exported successfully!`);
                                            }}
                                          >
                                            <i className="fas fa-download"></i>
                                          </Button>
                                          <Button
                                            variant="outline-success"
                                            size="sm"
                                            title="Export this quiz"
                                            onClick={() => {
                                              QuizBackupService.exportQuiz(quiz);
                                              showSuccessMessage(`Quiz "${quiz.title}" exported successfully!`);
                                            }}
                                          >
                                            <i className="fas fa-download"></i>
                                          </Button>
                                          <Button
                                            variant="outline-info"
                                            size="sm"
                                            title="Create a copy of this quiz"
                                            onClick={() => copyQuiz(quiz)}
                                          >
                                            <i className="fas fa-copy"></i>
                                          </Button>
                                          <Button
                                            variant="outline-primary"
                                            size="sm"
                                            title="Edit this quiz"
                                            onClick={() => navigate(`/edit-quiz/${quiz.id}`)}
                                          >
                                            <i className="fas fa-edit me-1"></i>
                                            Edit
                                          </Button>
                                          <Button
                                            variant="outline-danger"
                                            size="sm"
                                            title="Permanently delete this quiz"
                                            onClick={() => deleteSavedQuiz(quiz.id, quiz.title)}
                                          >
                                            <i className="fas fa-trash"></i>
                                          </Button>
                                        </div>
                                      </Card.Body>
                                    </Card>
                                  </Col>
                                ))}
                              </Row>
                            </div>
                          )}
                        </div>
                      </Col>
                    </Row>
                  </Card.Body>
                  <Card.Footer className="bg-light">
                    <div className="bg-light p-3 rounded">
                      <h6 className="fw-bold mb-2">
                        <i className="fas fa-lightbulb me-2"></i>
                        Storage Tips
                      </h6>
                      <ul className="small mb-0">
                        <li>Old quiz sessions are automatically cleaned up</li>
                        <li>Only the latest 10 sessions are kept</li>
                        <li>Sessions older than 7 days are removed</li>
                        <li>Use "Clear All Data" if you encounter storage errors</li>
                      </ul>
                    </div>
                  </Card.Footer>
                </Card>
              </Col>
            </Row>

            {/* Categories Management */}
            <Row className="mb-4">
              <Col>
                <Card className="border-0 shadow-sm">
                  <Card.Header className="bg-light">
                    <h5 className="mb-0 fw-bold">
                      <i className="fas fa-folder me-2"></i>
                      Categories ({categories.length})
                    </h5>
                  </Card.Header>
                  <Card.Body>
                    <Row className="g-2">
                      {categories.map(category => (
                        <Col md={6} lg={4} key={category.id}>
                          <Card className="border h-100">
                            <Card.Body className="d-flex flex-column">
                              <div className="flex-grow-1">
                                <h6 className="fw-bold text-primary">{category.name}</h6>
                                <p className="text-muted small mb-2">{category.description}</p>
                                <Badge bg="secondary">
                                  {getQuestionCountByCategory(category.id)} questions
                                </Badge>
                              </div>
                              <div className="mt-2">
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => deleteCategory(category.id)}
                                >
                                  <i className="fas fa-trash"></i>
                                </Button>
                              </div>
                            </Card.Body>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Questions Table */}
            <Row>
              <Col>
                <Card className="border-0 shadow-sm">
                  <Card.Header className="bg-light">
                    <div className="d-flex justify-content-between align-items-center">
                      <h5 className="mb-0 fw-bold">
                        <i className="fas fa-list me-2"></i>
                        Questions ({filteredQuestions.length})
                      </h5>
                      <Button variant="primary" href="/create-quiz">
                        <i className="fas fa-plus me-2"></i>
                        Add Questions
                      </Button>
                    </div>
                  </Card.Header>
                  <Card.Body className="p-0">
                    {filteredQuestions.length > 0 ? (
                      <Table responsive hover className="mb-0">
                        <thead className="bg-light">
                          <tr>
                            <th className="py-3">#</th>
                            <th className="py-3">Question</th>
                            <th className="py-3">Category</th>
                            <th className="py-3">Correct Answer</th>
                            <th className="py-3">Image</th>
                            <th className="py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredQuestions.map((question, index) => {
                            const category = categories.find(c => c.id === question.category);
                            return (
                              <tr key={question.id}>
                                <td className="py-3 fw-bold">{index + 1}</td>
                                <td className="py-3">
                                  <div className="admin-image-container">
                                    {question.question}
                                  </div>
                                </td>
                                <td className="py-3">
                                  <Badge bg="primary">{category?.name || 'Unknown'}</Badge>
                                </td>
                                <td className="py-3">
                                  <Badge bg="success">{question.correctAnswer.toUpperCase()}</Badge>
                                </td>
                                <td className="py-3">
                                  {question.imageUrl ? (
                                    <Badge bg="info">
                                      <i className="fas fa-image me-1"></i>
                                      Yes
                                    </Badge>
                                  ) : (
                                    <Badge bg="secondary">No</Badge>
                                  )}
                                </td>
                                <td className="py-3">
                                  <div className="d-flex gap-1">
                                    <Button
                                      variant="outline-primary"
                                      size="sm"
                                      onClick={() => handleEditQuestion(question)}
                                    >
                                      <i className="fas fa-edit"></i>
                                    </Button>
                                    <Button
                                      variant="outline-danger"
                                      size="sm"
                                      onClick={() => handleDeleteQuestion(question.id)}
                                    >
                                      <i className="fas fa-trash"></i>
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    ) : (
                      <div className="p-4 text-center text-muted">
                        <i className="fas fa-question-circle fa-3x mb-3"></i>
                        <h5>No questions found</h5>
                        <p>No questions match your current filters or there are no questions in the system.</p>
                        <Button variant="primary" href="/create-quiz">
                          <i className="fas fa-plus me-2"></i>
                          Create Your First Question
                        </Button>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Edit Question Modal */}
            <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg" centered>
              <Modal.Header closeButton>
                <Modal.Title>
                  <i className="fas fa-edit me-2"></i>
                  Edit Question
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                {editingQuestion && (
                  <Form>
                    <Row className="g-3">
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-bold">Category</Form.Label>
                          <Form.Select
                            value={editingQuestion.category}
                            onChange={(e) => setEditingQuestion({
                              ...editingQuestion,
                              category: e.target.value
                            })}
                          >
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-bold">Correct Answer</Form.Label>
                          <Form.Select
                            value={editingQuestion.correctAnswer}
                            onChange={(e) => setEditingQuestion({
                              ...editingQuestion,
                              correctAnswer: e.target.value as 'a' | 'b' | 'c' | 'd'
                            })}
                          >
                            <option value="a">A</option>
                            <option value="b">B</option>
                            <option value="c">C</option>
                            <option value="d">D</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>

                      <Col xs={12}>
                        <Form.Group>
                          <Form.Label className="fw-bold">Question</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={3}
                            value={editingQuestion.question}
                            onChange={(e) => setEditingQuestion({
                              ...editingQuestion,
                              question: e.target.value
                            })}
                          />
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-bold">Option A</Form.Label>
                          <Form.Control
                            type="text"
                            value={editingQuestion.options.a}
                            onChange={(e) => setEditingQuestion({
                              ...editingQuestion,
                              options: { ...editingQuestion.options, a: e.target.value }
                            })}
                          />
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-bold">Option B</Form.Label>
                          <Form.Control
                            type="text"
                            value={editingQuestion.options.b}
                            onChange={(e) => setEditingQuestion({
                              ...editingQuestion,
                              options: { ...editingQuestion.options, b: e.target.value }
                            })}
                          />
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-bold">Option C</Form.Label>
                          <Form.Control
                            type="text"
                            value={editingQuestion.options.c}
                            onChange={(e) => setEditingQuestion({
                              ...editingQuestion,
                              options: { ...editingQuestion.options, c: e.target.value }
                            })}
                          />
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="fw-bold">Option D</Form.Label>
                          <Form.Control
                            type="text"
                            value={editingQuestion.options.d}
                            onChange={(e) => setEditingQuestion({
                              ...editingQuestion,
                              options: { ...editingQuestion.options, d: e.target.value }
                            })}
                          />
                        </Form.Group>
                      </Col>

                      {/* Image Upload */}
                      <Col xs={12}>
                        <div className="border rounded p-3 bg-light">
                          <h6 className="fw-bold mb-3">
                            <i className="fas fa-image me-2"></i>
                            Image (Optional)
                          </h6>

                          {editingQuestion.imageUrl ? (
                            <div className="text-center">
                              <img
                                src={editingQuestion.imageUrl}
                                alt="Question"
                                className="img-fluid rounded mb-3 admin-preview-image"
                              />
                              <div>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => setEditingQuestion({
                                    ...editingQuestion,
                                    imageUrl: undefined
                                  })}
                                >
                                  <i className="fas fa-trash me-2"></i>
                                  Remove Image
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div
                                className="border border-dashed rounded p-4 text-center mb-3 cursor-pointer"
                                onPaste={handleImagePaste}
                                onClick={() => document.getElementById('edit-file-input')?.click()}
                              >
                                {isUploading ? (
                                  <div>
                                    <i className="fas fa-spinner fa-spin fa-2x text-primary mb-2"></i>
                                    <p className="text-muted mb-0">Uploading...</p>
                                  </div>
                                ) : (
                                  <div>
                                    <i className="fas fa-cloud-upload-alt fa-2x text-primary mb-2"></i>
                                    <p className="text-muted mb-0">
                                      Click to upload or <kbd>Ctrl+V</kbd> to paste
                                    </p>
                                  </div>
                                )}
                              </div>

                              <input
                                id="edit-file-input"
                                type="file"
                                accept="image/*"
                                className="admin-file-input"
                                title="Upload image file"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(file);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </Col>
                    </Row>
                  </Form>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={saveEditedQuestion}>
                  <i className="fas fa-save me-2"></i>
                  Save Changes
                </Button>
              </Modal.Footer>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
              <Modal.Header closeButton>
                <Modal.Title>
                  <i className="fas fa-exclamation-triangle me-2 text-warning"></i>
                  Confirm Delete
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <p>Are you sure you want to delete this question? This action cannot be undone.</p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={confirmDeleteQuestion}>
                  <i className="fas fa-trash me-2"></i>
                  Delete Question
                </Button>
              </Modal.Footer>
            </Modal>

            {/* Create Category Modal */}
            <Modal show={showCategoryModal} onHide={() => setShowCategoryModal(false)} centered>
              <Modal.Header closeButton>
                <Modal.Title>
                  <i className="fas fa-folder-plus me-2"></i>
                  Create New Category
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <Form.Group>
                  <Form.Label className="fw-bold">Category Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Enter category name..."
                    onKeyPress={(e) => e.key === 'Enter' && createNewCategory()}
                  />
                </Form.Group>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowCategoryModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={createNewCategory}>
                  <i className="fas fa-plus me-2"></i>
                  Create Category
                </Button>
              </Modal.Footer>
            </Modal>

          </Tab.Pane>

          <Tab.Pane eventKey="real-time">
            <RealTimeDashboard />
          </Tab.Pane>

          <Tab.Pane eventKey="student-results">
            <StudentResults />
          </Tab.Pane>

          <Tab.Pane eventKey="registered-students">
            <Card className="shadow-sm">
              <Card.Header className="bg-primary text-white">
                <h5 className="mb-0">
                  <i className="fas fa-users me-2"></i>
                  Registered Students
                </h5>
              </Card.Header>
              <Card.Body>
                <RegisteredStudentsView />
              </Card.Body>
            </Card>
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </Container>
  );
};

// Registered Students View Component
const RegisteredStudentsView: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm]);

  const loadStudents = () => {
    const allStudents = realOTPService.getAllStudents();
    setStudents(allStudents);
  };

  const filterStudents = () => {
    if (!searchTerm.trim()) {
      setFilteredStudents(students);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = students.filter(student =>
      student.name.toLowerCase().includes(term) ||
      student.mobile?.includes(term) ||
      student.email?.toLowerCase().includes(term) ||
      student.className?.toLowerCase().includes(term)
    );
    setFilteredStudents(filtered);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <>
      <Row className="mb-3">
        <Col md={6}>
          <InputGroup>
            <InputGroup.Text>
              <i className="fas fa-search"></i>
            </InputGroup.Text>
            <Form.Control
              placeholder="Search by name, email, phone, or class..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </Col>
        <Col md={6} className="text-end">
          <Badge bg="info" className="p-2">
            Total Students: {students.length}
          </Badge>
        </Col>
      </Row>

      {filteredStudents.length === 0 ? (
        <Alert variant="info">
          <i className="fas fa-info-circle me-2"></i>
          {students.length === 0
            ? 'No students have registered yet.'
            : 'No students found matching your search.'}
        </Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead className="table-dark">
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Contact</th>
              <th>Class</th>
              <th>Auth Type</th>
              <th>Registered At</th>
              <th>Last Login</th>
              <th>Quizzes Taken</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student, index) => (
              <tr key={student.id}>
                <td>{index + 1}</td>
                <td>
                  <strong>{student.name}</strong>
                </td>
                <td>
                  {student.authType === 'mobile' ? (
                    <>
                      <i className="fas fa-phone me-1"></i>
                      {student.mobile}
                    </>
                  ) : (
                    <>
                      <i className="fas fa-envelope me-1"></i>
                      {student.email}
                    </>
                  )}
                </td>
                <td>{student.className || '-'}</td>
                <td>
                  <Badge bg={student.authType === 'mobile' ? 'primary' : 'success'}>
                    {student.authType === 'mobile' ? 'Mobile' : 'Email'}
                  </Badge>
                </td>
                <td className="small">{formatDate(student.registeredAt)}</td>
                <td className="small">
                  {student.lastLoginAt ? formatDate(student.lastLoginAt) : 'Never'}
                </td>
                <td className="text-center">
                  <Badge bg="secondary">{student.totalQuizzesTaken}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {filteredStudents.length > 0 && (
        <div className="text-muted small">
          Showing {filteredStudents.length} of {students.length} students
        </div>
      )}
    </>
  );
};

export default AdminPanel;
