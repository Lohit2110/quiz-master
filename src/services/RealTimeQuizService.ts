// Real-time Quiz Distribution Service - Like Physics Wallah
import { SavedQuiz, StudentInfo } from '../types';

export class RealTimeQuizService {
  private static instance: RealTimeQuizService;
  private subscribers: Map<string, (quizzes: SavedQuiz[]) => void> = new Map();
  private activeStudents: Map<string, StudentInfo> = new Map();
  private quizDatabase: SavedQuiz[] = [];
  private updateInterval: NodeJS.Timeout | null = null;

  static getInstance(): RealTimeQuizService {
    if (!RealTimeQuizService.instance) {
      RealTimeQuizService.instance = new RealTimeQuizService();
    }
    return RealTimeQuizService.instance;
  }

  // Initialize the service
  initialize() {
    this.loadQuizDatabase();
    this.startRealTimeUpdates();
    console.log('Real-time quiz service initialized');
  }

  // Load quiz database from localStorage
  private loadQuizDatabase() {
    try {
      const savedQuizzes = localStorage.getItem('quiz_master_saved_quizzes');
      if (savedQuizzes) {
        this.quizDatabase = JSON.parse(savedQuizzes);
      }
      
      // Also load from global database if available
      const globalQuizzes = localStorage.getItem('quiz_master_global_quizzes');
      if (globalQuizzes) {
        const global = JSON.parse(globalQuizzes);
        this.quizDatabase = [...this.quizDatabase, ...global];
        
        // Remove duplicates
        this.quizDatabase = this.quizDatabase.filter((quiz, index, self) =>
          index === self.findIndex(q => q.id === quiz.id)
        );
      }
    } catch (error) {
      console.error('Error loading quiz database:', error);
    }
  }

  // Save quiz database
  private saveQuizDatabase() {
    // Don't save to localStorage - causes QuotaExceeded errors with large images
    // Quizzes are kept in React state and synced from Firebase
    console.log(`💾 Skipping localStorage save (${this.quizDatabase.length} quizzes in memory)`);
  }

  // Start real-time updates (like Physics Wallah's live system)
  private startRealTimeUpdates() {
    // Check for updates every 10 seconds
    this.updateInterval = setInterval(() => {
      this.checkForUpdates();
    }, 10000);
  }

  // Check for quiz updates and notify all subscribers
  private checkForUpdates() {
    const lastUpdate = localStorage.getItem('quiz_master_last_update');
    const currentTime = Date.now();
    
    // If there's been an update in the last 30 seconds, notify all students
    if (lastUpdate && (currentTime - parseInt(lastUpdate)) < 30000) {
      this.notifyAllSubscribers();
    }
  }

  // Register a student for real-time updates
  registerStudent(studentId: string, studentInfo: StudentInfo, callback: (quizzes: SavedQuiz[]) => void) {
    this.activeStudents.set(studentId, studentInfo);
    this.subscribers.set(studentId, callback);
    
    // Immediately send current quizzes
    callback(this.quizDatabase);
    
    console.log(`Student registered for real-time updates: ${studentInfo.name}`);
    
    // Log student activity
    this.logStudentActivity(studentId, 'connected');
  }

  // Unregister a student
  unregisterStudent(studentId: string) {
    const student = this.activeStudents.get(studentId);
    this.activeStudents.delete(studentId);
    this.subscribers.delete(studentId);
    
    if (student) {
      this.logStudentActivity(studentId, 'disconnected');
      console.log(`Student unregistered: ${student.name}`);
    }
  }

  // Publish new quiz to all students (like Physics Wallah's content upload)
  publishQuizToAllStudents(quiz: SavedQuiz): boolean {
    try {
      // Add to database
      const existingIndex = this.quizDatabase.findIndex(q => q.id === quiz.id);
      if (existingIndex >= 0) {
        this.quizDatabase[existingIndex] = quiz;
      } else {
        this.quizDatabase.push(quiz);
      }

      // Add publish timestamp
      quiz.publishedAt = Date.now();
      quiz.publishedBy = 'admin';

      // Save to storage
      this.saveQuizDatabase();

      // Notify all active students immediately
      this.notifyAllSubscribers();

      // Log the publication
      console.log(`Quiz "${quiz.title}" published to ${this.activeStudents.size} active students`);
      
      // Store publication log
      this.logQuizPublication(quiz);

      return true;
    } catch (error) {
      console.error('Error publishing quiz:', error);
      return false;
    }
  }

  // Notify all subscribed students
  private notifyAllSubscribers() {
    this.subscribers.forEach((callback, studentId) => {
      try {
        callback([...this.quizDatabase]);
      } catch (error) {
        console.error(`Error notifying student ${studentId}:`, error);
      }
    });

    // Create notification event
    window.dispatchEvent(new CustomEvent('quizUpdate', {
      detail: {
        quizCount: this.quizDatabase.length,
        activeStudents: this.activeStudents.size,
        timestamp: Date.now()
      }
    }));
  }

  // Get all available quizzes
  getAllQuizzes(): SavedQuiz[] {
    return [...this.quizDatabase];
  }

  // Get active students count
  getActiveStudentsCount(): number {
    return this.activeStudents.size;
  }

  // Get active students list
  getActiveStudents(): StudentInfo[] {
    return Array.from(this.activeStudents.values());
  }

  // Delete quiz (admin only)
  deleteQuiz(quizId: string): boolean {
    try {
      const initialLength = this.quizDatabase.length;
      this.quizDatabase = this.quizDatabase.filter(quiz => quiz.id !== quizId);
      
      if (this.quizDatabase.length < initialLength) {
        this.saveQuizDatabase();
        this.notifyAllSubscribers();
        console.log(`Quiz ${quizId} deleted and update sent to all students`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting quiz:', error);
      return false;
    }
  }

  // Update quiz (admin only)
  updateQuiz(updatedQuiz: SavedQuiz): boolean {
    try {
      const index = this.quizDatabase.findIndex(quiz => quiz.id === updatedQuiz.id);
      if (index >= 0) {
        this.quizDatabase[index] = { ...updatedQuiz, lastModified: Date.now() };
        this.saveQuizDatabase();
        this.notifyAllSubscribers();
        console.log(`Quiz "${updatedQuiz.title}" updated and sent to all students`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating quiz:', error);
      return false;
    }
  }

  // Log student activity
  private logStudentActivity(studentId: string, action: string) {
    const logs = JSON.parse(localStorage.getItem('quiz_master_student_logs') || '[]');
    logs.push({
      studentId,
      action,
      timestamp: Date.now(),
      date: new Date().toLocaleString()
    });
    
    // Keep only last 100 logs
    if (logs.length > 100) {
      logs.splice(0, logs.length - 100);
    }
    
    localStorage.setItem('quiz_master_student_logs', JSON.stringify(logs));
  }

  // Log quiz publication
  private logQuizPublication(quiz: SavedQuiz) {
    const publications = JSON.parse(localStorage.getItem('quiz_master_publications') || '[]');
    publications.push({
      quizId: quiz.id,
      title: quiz.title,
      publishedAt: Date.now(),
      studentsNotified: this.activeStudents.size,
      date: new Date().toLocaleString()
    });
    
    localStorage.setItem('quiz_master_publications', JSON.stringify(publications));
  }

  // Get student activity logs
  getStudentLogs() {
    return JSON.parse(localStorage.getItem('quiz_master_student_logs') || '[]');
  }

  // Get publication logs
  getPublicationLogs() {
    return JSON.parse(localStorage.getItem('quiz_master_publications') || '[]');
  }

  // Force sync for all students (emergency update)
  forceSyncAllStudents() {
    this.loadQuizDatabase();
    this.notifyAllSubscribers();
    console.log('Force sync triggered for all students');
  }

  // Cleanup on app close
  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.subscribers.clear();
    this.activeStudents.clear();
  }

  // Get system stats (for admin dashboard)
  getSystemStats() {
    return {
      totalQuizzes: this.quizDatabase.length,
      activeStudents: this.activeStudents.size,
      totalPublications: this.getPublicationLogs().length,
      lastUpdate: localStorage.getItem('quiz_master_last_update'),
      systemUptime: Date.now() - (parseInt(localStorage.getItem('quiz_master_start_time') || '0'))
    };
  }
}

export const realTimeQuizService = RealTimeQuizService.getInstance();