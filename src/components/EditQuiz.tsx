import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert, Badge, Modal } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { QuizQuestion } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useQuizContext } from '../contexts/QuizContext';
import { EnhancedCloudSync } from '../services/EnhancedCloudSync';
import { ImageUtils } from '../utils/storage';
import './Quiz.css';

const EditQuiz: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Only admin can edit quizzes
  if (!isAdmin) {
    return (
      <Container className="py-5 text-center">
        <Card className="shadow-sm">
          <Card.Body className="p-5">
            <i className="fas fa-lock fa-3x text-warning mb-3"></i>
            <h4>Access Restricted</h4>
            <p className="text-muted">
              Only administrators can edit quizzes. Please login with admin credentials.
            </p>
            <Button variant="primary" href="/">
              Go to Home
            </Button>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return <EditQuizContent />;
};

const EditQuizContent: React.FC = () => {
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();
  const { quizzes, refreshQuizzes } = useQuizContext();

  const [quiz, setQuiz] = useState<any>(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [timerMinutes, setTimerMinutes] = useState(30);
  const [subject, setSubject] = useState('');
  const [chapters, setChapters] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'danger' | 'warning', message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // Index of a question pending delete confirmation (replaces window.confirm)
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  // Use a ref so that the Firebase real-time listener updating `quizzes` in
  // QuizContext never triggers a re-load and overwrites the user's local edits.
  const quizLoadedRef = useRef(false);

  // Form state for editing/adding a question
  const [questionText, setQuestionText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState<'a' | 'b' | 'c' | 'd'>('a');
  const [questionImages, setQuestionImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isPasteModeEnabled, setIsPasteModeEnabled] = useState(false);

  const MAX_IMAGES = 5;

  // Load quiz data ONCE on initial mount.
  // We use a ref (quizLoadedRef) instead of state so that subsequent updates
  // to the `quizzes` context (caused by Firebase real-time listeners) do NOT
  // re-trigger this effect and overwrite the user's unsaved local edits.
  useEffect(() => {
    if (quizLoadedRef.current) return; // already loaded — ignore context refreshes
    if (!quizId || quizzes.length === 0) {
      console.log('⏳ Waiting for quizzes to load... quizId:', quizId, 'quizzes count:', quizzes.length);
      return;
    }

    const foundQuiz = quizzes.find(q => q.id === quizId);
    if (foundQuiz) {
      console.log('📝 Loading quiz for editing:', foundQuiz.title);
      const quizQuestions = foundQuiz.questions || [];
      console.log('📋 Setting questions state with', quizQuestions.length, 'questions');

      setQuiz(foundQuiz);
      setQuizTitle(foundQuiz.title);
      setQuizDescription(foundQuiz.description || '');
      setTimerMinutes(foundQuiz.defaultTimerMinutes || 30);
      setSubject(foundQuiz.subject || '');
      setChapters(foundQuiz.chapters?.join(', ') || '');
      setQuestions([...quizQuestions]);

      // Mark as loaded — using ref so this never causes a re-render
      quizLoadedRef.current = true;
      console.log('✅ Quiz loaded successfully with', quizQuestions.length, 'questions');
    } else {
      console.log('❌ Quiz not found:', quizId);
      console.log('🔍 Available quizzes:', quizzes.map(q => ({ id: q.id, title: q.title })));
      showErrorMessage('Quiz not found');
      setTimeout(() => navigate('/admin'), 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, quizzes]);

  const showSuccessMessage = (message: string) => {
    setAlert({ type: 'success', message });
    setTimeout(() => setAlert(null), 5000);
  };

  const showErrorMessage = (message: string) => {
    setAlert({ type: 'danger', message });
    setTimeout(() => setAlert(null), 5000);
  };

  // Multi-image helpers (matching QuizBuilder pattern)
  const addImageUrl = (url: string) => {
    setQuestionImages(prev => {
      if (prev.length >= MAX_IMAGES) return prev;
      return [...prev, url];
    });
  };

  const replaceLastImageUrl = (url: string) => {
    setQuestionImages(prev => {
      const updated = [...prev];
      updated[updated.length - 1] = url;
      return updated;
    });
  };

  const removeImageUrl = (imgIndex: number) => {
    setQuestionImages(prev => prev.filter((_, idx) => idx !== imgIndex));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (questionImages.length >= MAX_IMAGES) {
      showErrorMessage(`Maximum ${MAX_IMAGES} images allowed per question.`);
      return;
    }

    try {
      // INSTANT: show preview immediately
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          addImageUrl(ev.target.result as string);
          showSuccessMessage('✅ Image loaded! Uploading in background...');
        }
      };
      reader.readAsDataURL(file);

      // BACKGROUND: Upload to Cloudinary
      setIsUploadingImage(true);
      ImageUtils.handleFileUpload(file).then((cloudinaryUrl) => {
        replaceLastImageUrl(cloudinaryUrl);
        showSuccessMessage('✅ Image uploaded to cloud!');
        setIsUploadingImage(false);
      }).catch(() => {
        console.warn('Upload to Cloudinary failed, keeping local preview');
        setIsUploadingImage(false);
      });
    } catch (error) {
      showErrorMessage('Failed to upload image. Please try again.');
      setIsUploadingImage(false);
    }
  };

  const handleImagePaste = async (event: React.ClipboardEvent) => {
    event.preventDefault();

    if (!isPasteModeEnabled) {
      showErrorMessage('Please click "Enable Paste" button first!');
      return;
    }

    if (questionImages.length >= MAX_IMAGES) {
      showErrorMessage(`Maximum ${MAX_IMAGES} images allowed per question.`);
      return;
    }

    setIsUploadingImage(true);
    try {
      console.log('📋 Processing pasted image...');
      const { previewUrl, uploadPromise } = await ImageUtils.handleClipboardPaste(event.nativeEvent as ClipboardEvent);

      // ⚡ INSTANT: show preview immediately
      addImageUrl(previewUrl);

      const newCount = questionImages.length + 1;
      if (newCount >= MAX_IMAGES) {
        showSuccessMessage(`✅ Image pasted! (max ${MAX_IMAGES} reached)`);
        setIsPasteModeEnabled(false);
      } else {
        showSuccessMessage(`✅ Image pasted! You can paste ${MAX_IMAGES - newCount} more.`);
      }
      setIsUploadingImage(false);

      // ☁️ BACKGROUND: swap with Cloudinary URL silently
      uploadPromise.then((cloudUrl) => {
        if (cloudUrl !== previewUrl) {
          replaceLastImageUrl(cloudUrl);
          console.log('✅ Preview swapped with Cloudinary URL');
        }
      });

    } catch (error) {
      console.error('❌ Paste error:', error);
      showErrorMessage(error instanceof Error ? error.message : 'Failed to paste image. Try uploading instead.');
      setIsUploadingImage(false);
    }
  };

  const openAddQuestionModal = () => {
    setEditingQuestionIndex(null);
    setQuestionText('');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setOptionD('');
    setCorrectAnswer('a');
    setQuestionImages([]);
    setIsPasteModeEnabled(false);
    setShowQuestionModal(true);
  };

  const openEditQuestionModal = (index: number) => {
    const question = questions[index];
    setEditingQuestionIndex(index);
    setQuestionText(question.question);
    setOptionA(question.options.a);
    setOptionB(question.options.b);
    setOptionC(question.options.c);
    setOptionD(question.options.d);
    setCorrectAnswer(question.correctAnswer);
    // Load existing images — prefer imageUrls array, fall back to single imageUrl
    const existingImages = (question as any).imageUrls && (question as any).imageUrls.length > 0
      ? (question as any).imageUrls
      : question.imageUrl ? [question.imageUrl] : [];
    setQuestionImages(existingImages);
    setIsPasteModeEnabled(false);
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = () => {
    // Both question text and image are optional — at least one should be present
    if (!questionText.trim() && questionImages.length === 0) {
      showErrorMessage('Please enter question text or add an image');
      return;
    }

    // Options are always A/B/C/D (shown in image)
    const finalOptionA = 'A';
    const finalOptionB = 'B';
    const finalOptionC = 'C';
    const finalOptionD = 'D';

    console.log('💾 Saving question with', questionImages.length, 'images');

    const newQuestion: QuizQuestion = {
      id: editingQuestionIndex !== null ? questions[editingQuestionIndex].id : `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      question: questionText,
      options: {
        a: finalOptionA,
        b: finalOptionB,
        c: finalOptionC,
        d: finalOptionD
      },
      correctAnswer,
      category: questions[0]?.category || quiz?.id || 'general',
      imageUrl: questionImages[0] || '',
      imageUrls: questionImages.length > 0 ? questionImages : undefined
    };

    console.log('📝 New question object:', { id: newQuestion.id, imageCount: questionImages.length });

    if (editingQuestionIndex !== null) {
      // Update existing question
      const updatedQuestions = [...questions];
      updatedQuestions[editingQuestionIndex] = newQuestion;
      setQuestions(updatedQuestions);
      setHasUnsavedChanges(true);
      console.log('✅ Updated question at index:', editingQuestionIndex);
      showSuccessMessage('Question updated! Click "Save Changes" to persist.');
    } else {
      // Add new question
      const newQuestions = [...questions, newQuestion];
      setQuestions(newQuestions);
      setHasUnsavedChanges(true);
      console.log('✅ Added new question. Total questions:', newQuestions.length);
      showSuccessMessage(`Question added! Total: ${newQuestions.length}. Click "Save Changes" to persist.`);
    }

    setShowQuestionModal(false);
  };

  // Delete confirmation is done inline (window.confirm is blocked on HTTPS by many browsers)
  const handleDeleteConfirm = (index: number) => {
    setDeleteConfirmIndex(index);
  };

  const handleDeleteExecute = (index: number) => {
    const updatedQuestions = questions.filter((_, i) => i !== index);
    setQuestions(updatedQuestions);
    setHasUnsavedChanges(true);
    setDeleteConfirmIndex(null);
    console.log('🗑️ Deleted question at index:', index);
    showSuccessMessage(`Question deleted! ${updatedQuestions.length} remaining. Click "Save Changes" to persist.`);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmIndex(null);
  };

  const handleSaveQuiz = async () => {
    if (!quizTitle.trim()) {
      showErrorMessage('Please enter a quiz title');
      return;
    }
    if (questions.length === 0) {
      showErrorMessage('Please add at least one question');
      return;
    }

    console.log('🔄 handleSaveQuiz called');
    console.log('📋 Current questions:', questions.length);

    setIsSaving(true);
    setAlert(null); // clear any existing alert
    try {
      const chaptersArray = chapters
        ? chapters.split(',').map(ch => ch.trim()).filter(ch => ch.length > 0)
        : null;

      const questionsToSave = [...questions];
      console.log('💾 Questions to save:', questionsToSave.length);

      const updatedQuiz = {
        ...quiz,
        title: quizTitle,
        description: quizDescription,
        defaultTimerMinutes: timerMinutes,
        subject: subject || null,
        chapters: chaptersArray,
        questions: questionsToSave,
        lastModified: Date.now()
      };

      console.log('💾 Saving to Firebase...');
      await EnhancedCloudSync.saveQuizUnlimited(updatedQuiz);

      // Success!
      setHasUnsavedChanges(false);
      console.log('✅ Quiz saved successfully!');
      // Show success with a manual navigate button so user sees the result
      setAlert({
        type: 'success',
        message: '✅ Quiz saved successfully! All changes have been saved to the cloud.'
      });
      // Refresh context in background
      refreshQuizzes().catch(err => console.warn('Background refresh failed:', err));
    } catch (error) {
      console.error('Error saving quiz:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showErrorMessage(`❌ Save failed: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!quiz) {
    return (
      <Container className="py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Loading quiz...</p>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="display-6 fw-bold">
                <i className="fas fa-edit me-3"></i>
                Edit Quiz
              </h1>
              {hasUnsavedChanges && (
                <span className="badge bg-warning text-dark ms-2" style={{ fontSize: '0.85rem' }}>
                  <i className="fas fa-exclamation-triangle me-1"></i>
                  Unsaved changes — click "Save Changes"
                </span>
              )}
            </div>
            <Button variant="outline-secondary" onClick={() => navigate('/admin')}>
              <i className="fas fa-arrow-left me-2"></i>
              Back to Admin
            </Button>
          </div>
        </Col>
      </Row>

      {/* Alert */}
      {alert && (
        <Alert variant={alert.type} dismissible onClose={() => setAlert(null)} className="mb-4">
          {alert.message}
          {alert.type === 'success' && (
            <div className="mt-2">
              <Button variant="success" size="sm" onClick={() => navigate('/admin')}>
                <i className="fas fa-arrow-left me-2"></i>
                Go to Admin Panel
              </Button>
            </div>
          )}
        </Alert>
      )}

      {/* Quiz Details Card */}
      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-primary text-white">
          <h5 className="mb-0">
            <i className="fas fa-info-circle me-2"></i>
            Quiz Details
          </h5>
        </Card.Header>
        <Card.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Quiz Title *</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter quiz title"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Enter quiz description (optional)"
                value={quizDescription}
                onChange={(e) => setQuizDescription(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                <i className="fas fa-book me-2"></i>
                Subject
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g., Physics, Mathematics, Chemistry..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <Form.Text className="text-muted">
                Enter the subject name for this quiz
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                <i className="fas fa-bookmark me-2"></i>
                Chapters
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="e.g., Motion, Force, Energy..."
                value={chapters}
                onChange={(e) => setChapters(e.target.value)}
              />
              <Form.Text className="text-muted">
                Enter chapter names separated by commas
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Default Time Limit (minutes)</Form.Label>
              <Form.Control
                type="number"
                min="1"
                max="180"
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(parseInt(e.target.value) || 30)}
              />
              <Form.Text className="text-muted">
                Students will have {timerMinutes} minutes to complete this quiz
              </Form.Text>
            </Form.Group>
          </Form>
        </Card.Body>
      </Card>

      {/* Questions Card */}
      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-success text-white">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              <i className="fas fa-question-circle me-2"></i>
              Questions ({questions.length})
            </h5>
          </div>
        </Card.Header>
        <Card.Body>
          {questions.length === 0 ? (
            <div className="text-center py-5">
              <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
              <p className="text-muted">No questions yet. Click "Add Question" to start.</p>
            </div>
          ) : (
            <div className="accordion" id="questionsAccordion">
              {questions.map((question, index) => (
                <div className="accordion-item" key={question.id}>
                  <h2 className="accordion-header">
                    <button
                      className="accordion-button collapsed"
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target={`#question-${index}`}
                    >
                      <Badge bg="secondary" className="me-2">Q{index + 1}</Badge>
                      {question.question}
                      {question.imageUrl && <i className="fas fa-image ms-2 text-primary"></i>}
                    </button>
                  </h2>
                  <div
                    id={`question-${index}`}
                    className="accordion-collapse collapse"
                    data-bs-parent="#questionsAccordion"
                  >
                    <div className="accordion-body">
                      {question.imageUrl && (
                        <div className="mb-3">
                          <img
                            src={question.imageUrl}
                            alt="Question"
                            style={{ maxWidth: '100%', maxHeight: '200px' }}
                            className="rounded"
                          />
                        </div>
                      )}
                      <div className="mb-3">
                        <strong>Options:</strong>
                        <ul className="mt-2">
                          <li className={question.correctAnswer === 'a' ? 'text-success fw-bold' : ''}>
                            A) {question.options.a} {question.correctAnswer === 'a' && '✓'}
                          </li>
                          <li className={question.correctAnswer === 'b' ? 'text-success fw-bold' : ''}>
                            B) {question.options.b} {question.correctAnswer === 'b' && '✓'}
                          </li>
                          <li className={question.correctAnswer === 'c' ? 'text-success fw-bold' : ''}>
                            C) {question.options.c} {question.correctAnswer === 'c' && '✓'}
                          </li>
                          <li className={question.correctAnswer === 'd' ? 'text-success fw-bold' : ''}>
                            D) {question.options.d} {question.correctAnswer === 'd' && '✓'}
                          </li>
                        </ul>
                      </div>
                      <div className="d-flex gap-2 flex-wrap">
                        {deleteConfirmIndex === index ? (
                          // Inline confirm — avoids window.confirm which HTTPS browsers block
                          <>
                            <span className="text-danger fw-bold me-2 align-self-center">
                              <i className="fas fa-exclamation-triangle me-1"></i>
                              Delete this question?
                            </span>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteExecute(index)}
                            >
                              <i className="fas fa-check me-1"></i>
                              Yes, Delete
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={handleDeleteCancel}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => openEditQuestionModal(index)}
                            >
                              <i className="fas fa-edit me-1"></i>
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteConfirm(index)}
                            >
                              <i className="fas fa-trash me-1"></i>
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Question button at bottom */}
          <div className="text-center mt-3">
            <Button variant="outline-primary" onClick={openAddQuestionModal}>
              <i className="fas fa-plus me-2"></i>
              Add Question
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* Save Button */}
      <div className="text-center mb-5">
        <Button
          variant="success"
          size="lg"
          onClick={handleSaveQuiz}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              Saving...
            </>
          ) : (
            <>
              <i className="fas fa-save me-2"></i>
              Save Changes
            </>
          )}
        </Button>
        <Button
          variant="outline-secondary"
          size="lg"
          className="ms-3"
          onClick={() => navigate('/admin')}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </div>

      {/* Question Edit Modal */}
      <Modal show={showQuestionModal} onHide={() => setShowQuestionModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-question-circle me-2"></i>
            {editingQuestionIndex !== null ? 'Edit Question' : 'Add Question'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Question Text (Optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Enter your question (leave empty for image-only questions)"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                <i className="fas fa-image me-2"></i>
                Images (Optional — max {MAX_IMAGES})
                <span className="ms-2 badge bg-secondary">
                  {questionImages.length} / {MAX_IMAGES}
                </span>
              </Form.Label>

              {/* Existing images grid */}
              {questionImages.length > 0 && (
                <Row className="g-2 mb-3">
                  {questionImages.map((url, imgIdx) => (
                    <Col key={imgIdx} xs={12} sm={4}>
                      <div className="position-relative border rounded overflow-hidden" style={{ height: '150px' }}>
                        <img
                          src={url}
                          alt={`Question image ${imgIdx + 1}`}
                          className="w-100 h-100"
                          style={{ objectFit: 'contain', backgroundColor: '#f8f9fa' }}
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          className="position-absolute top-0 end-0 m-1 px-2 py-0"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => removeImageUrl(imgIdx)}
                        >
                          <i className="fas fa-times"></i>
                        </Button>
                        <span
                          className="position-absolute bottom-0 start-0 m-1 badge bg-dark"
                          style={{ fontSize: '0.65rem' }}
                        >
                          {imgIdx + 1}
                        </span>
                      </div>
                    </Col>
                  ))}
                </Row>
              )}

              {/* Upload / Paste controls — only when < MAX_IMAGES */}
              {questionImages.length < MAX_IMAGES ? (
                <div>
                  <div className="d-flex gap-2 mb-2">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => document.getElementById('image-upload-input')?.click()}
                      disabled={isUploadingImage}
                    >
                      <i className="fas fa-upload me-2"></i>
                      Upload Image
                    </Button>
                    <Button
                      variant={isPasteModeEnabled ? "primary" : "outline-secondary"}
                      size="sm"
                      onClick={() => setIsPasteModeEnabled(!isPasteModeEnabled)}
                      disabled={isUploadingImage}
                    >
                      <i className="fas fa-paste me-2"></i>
                      {isPasteModeEnabled ? "Paste Mode ON" : "Enable Paste"}
                    </Button>
                  </div>

                  <Form.Control
                    id="image-upload-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploadingImage}
                    style={{ display: 'none' }}
                  />

                  {isPasteModeEnabled && (
                    <div
                      className="border border-dashed rounded p-4 text-center mb-3"
                      style={{ cursor: 'text', backgroundColor: '#f8f9fa' }}
                      onPaste={handleImagePaste}
                      tabIndex={0}
                    >
                      {isUploadingImage ? (
                        <div>
                          <i className="fas fa-spinner fa-spin fa-2x text-primary mb-2"></i>
                          <p className="text-muted mb-0">Uploading...</p>
                        </div>
                      ) : (
                        <div>
                          <i className="fas fa-clipboard fa-2x text-success mb-2"></i>
                          <p className="text-muted mb-0">
                            Press <kbd>Ctrl+V</kbd> to paste an image here
                          </p>
                          <small className="text-success">
                            Paste mode active — {MAX_IMAGES - questionImages.length} slot{MAX_IMAGES - questionImages.length !== 1 ? 's' : ''} remaining
                          </small>
                        </div>
                      )}
                    </div>
                  )}

                  {isUploadingImage && !isPasteModeEnabled && (
                    <div className="text-primary mt-2">
                      <span className="spinner-border spinner-border-sm me-2" />
                      Uploading image...
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted py-2">
                  <i className="fas fa-check-circle text-success me-2"></i>
                  Maximum {MAX_IMAGES} images added. Remove one to add another.
                </div>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Correct Answer *</Form.Label>
              <Form.Select
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value as 'a' | 'b' | 'c' | 'd')}
              >
                <option value="a">A (Option A)</option>
                <option value="b">B (Option B)</option>
                <option value="c">C (Option C)</option>
                <option value="d">D (Option D)</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowQuestionModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveQuestion}>
            <i className="fas fa-save me-2"></i>
            {editingQuestionIndex !== null ? 'Update Question' : 'Add Question'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default EditQuiz;
