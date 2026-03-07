/**
 * StudentResultsService - Robust Student Quiz Results Management
 * 
 * This service handles all student quiz result operations with Firebase.
 * It provides a clean, simple API for saving, retrieving, and managing student results.
 * 
 * Key Features:
 * - Automatic retry on failure
 * - Real-time updates via Firebase listeners
 * - Local backup to localStorage
 * - Proper error handling and logging
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  Timestamp,
  Unsubscribe
} from 'firebase/firestore';
import { db, COLLECTIONS } from '../config/firebase';
import { QuizResult } from '../types';

// Constants
const LOCAL_STORAGE_KEY = 'quiz_master_student_results';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Convert Firebase Timestamp to JavaScript timestamp (milliseconds)
 */
function convertFirebaseTimestamp(value: any): number {
  if (!value) return Date.now();
  
  // Firebase Timestamp with toMillis method
  if (value && typeof value === 'object' && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  
  // Firestore Timestamp with seconds/nanoseconds
  if (value && typeof value === 'object' && 'seconds' in value) {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
  }
  
  // Already a number
  if (typeof value === 'number') {
    return value;
  }
  
  // String date
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return isNaN(parsed) ? Date.now() : parsed;
  }
  
  return Date.now();
}

/**
 * Parse Firestore document data into QuizResult
 */
function parseFirestoreResult(docId: string, data: any): QuizResult {
  return {
    sessionId: data.sessionId || docId,
    categoryName: data.categoryName || 'Unknown Category',
    quizTitle: data.quizTitle || 'Unknown Quiz',
    studentName: data.studentName || 'Anonymous',
    studentEmail: data.studentEmail || '',
    totalQuestions: Number(data.totalQuestions) || 0,
    correctAnswers: Number(data.correctAnswers) || 0,
    incorrectAnswers: Number(data.incorrectAnswers) || 0,
    skippedQuestions: Number(data.skippedQuestions) || 0,
    score: Number(data.score) || 0,
    percentage: Number(data.percentage) || 0,
    totalMarks: Number(data.totalMarks) || 0,
    maxMarks: Number(data.maxMarks) || 0,
    timeTaken: Number(data.timeTaken) || 0,
    completedAt: convertFirebaseTimestamp(data.completedAt),
    detailedResults: Array.isArray(data.detailedResults) ? data.detailedResults : []
  };
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Student Results Service Class
 */
class StudentResultsServiceClass {
  private static instance: StudentResultsServiceClass;
  private activeListeners: Unsubscribe[] = [];
  private cachedResults: QuizResult[] = [];
  private lastFetchTime: number = 0;
  private isInitialized: boolean = false;

  private constructor() {
    this.loadFromLocalStorage();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): StudentResultsServiceClass {
    if (!StudentResultsServiceClass.instance) {
      StudentResultsServiceClass.instance = new StudentResultsServiceClass();
    }
    return StudentResultsServiceClass.instance;
  }

  /**
   * Load cached results from localStorage
   */
  private loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        this.cachedResults = JSON.parse(stored);
        console.log(`📦 Loaded ${this.cachedResults.length} cached results from localStorage`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load results from localStorage:', error);
      this.cachedResults = [];
    }
  }

  /**
   * Save results to localStorage as backup
   */
  private saveToLocalStorage(results: QuizResult[]): void {
    try {
      // Keep only last 100 results to prevent storage overflow
      const trimmedResults = results.slice(0, 100);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmedResults));
      console.log(`💾 Saved ${trimmedResults.length} results to localStorage backup`);
    } catch (error) {
      console.warn('⚠️ Failed to save results to localStorage:', error);
    }
  }

  /**
   * SAVE a student result to Firebase
   * This is the PRIMARY method to save quiz results
   * 
   * @param result - The quiz result to save
   * @returns Promise<boolean> - true if saved successfully
   */
  async saveResult(result: QuizResult): Promise<boolean> {
    console.log('═'.repeat(60));
    console.log('💾 SAVING STUDENT RESULT TO FIREBASE');
    console.log('═'.repeat(60));
    console.log('📝 Session ID:', result.sessionId);
    console.log('👤 Student:', result.studentName);
    console.log('📧 Email:', result.studentEmail || 'N/A');
    console.log('📚 Quiz:', result.quizTitle);
    console.log('📊 Score:', `${result.totalMarks}/${result.maxMarks} (${result.percentage}%)`);
    console.log('🔥 Firebase DB:', db ? 'INITIALIZED' : 'NOT INITIALIZED');
    console.log('📂 Collection:', COLLECTIONS.ATTEMPTS);
    console.log('═'.repeat(60));

    // Retry logic for reliability
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${MAX_RETRY_ATTEMPTS} - Creating document...`);
        
        // Prepare SUMMARY data for main document (without detailed results to stay under 1MB)
        const summaryData = {
          sessionId: result.sessionId,
          categoryName: result.categoryName,
          quizTitle: result.quizTitle,
          studentName: result.studentName,
          studentEmail: result.studentEmail || '',
          totalQuestions: result.totalQuestions,
          correctAnswers: result.correctAnswers,
          incorrectAnswers: result.incorrectAnswers,
          skippedQuestions: result.skippedQuestions,
          score: result.score,
          percentage: result.percentage,
          totalMarks: result.totalMarks,
          maxMarks: result.maxMarks,
          timeTaken: result.timeTaken,
          completedAt: result.completedAt || Date.now(),
          submittedAt: Timestamp.now(),
          savedAttempt: attempt,
          hasDetailedResults: true // Flag to indicate subcollection exists
        };
        
        console.log('📦 Summary data to save:', JSON.stringify({
          sessionId: summaryData.sessionId,
          studentName: summaryData.studentName,
          quizTitle: summaryData.quizTitle,
          percentage: summaryData.percentage,
          totalQuestions: summaryData.totalQuestions
        }));

        // Save main summary document
        console.log('📄 Creating main document reference...');
        const docRef = doc(db, COLLECTIONS.ATTEMPTS, result.sessionId);
        console.log('📄 Document path:', docRef.path);
        
        console.log('⏳ Saving summary document...');
        await setDoc(docRef, summaryData);
        console.log('✅ Summary document saved!');

        // Save detailed results in subcollection (one document per question)
        console.log('📸 Saving detailed results with images to subcollection...');
        const detailsPromises = result.detailedResults.map((detail, index) => {
          const detailDocRef = doc(db, COLLECTIONS.ATTEMPTS, result.sessionId, 'details', `q${index + 1}`);
          return setDoc(detailDocRef, {
            questionNumber: index + 1,
            ...detail,
            savedAt: Timestamp.now()
          });
        });
        
        await Promise.all(detailsPromises);
        console.log(`✅ Saved ${result.detailedResults.length} detailed results with images!`);

        console.log('✅ Result saved to Firebase successfully!');
        console.log(`🔍 Verify at: Firebase Console → Firestore → ${COLLECTIONS.ATTEMPTS} → ${result.sessionId}`);

        // Also save to local cache
        this.addToCache(result);
        this.saveToLocalStorage(this.cachedResults);

        return true;

      } catch (error: any) {
        console.error(`❌ Attempt ${attempt}/${MAX_RETRY_ATTEMPTS} failed:`, error);
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error stack:', error.stack);
        
        if (attempt < MAX_RETRY_ATTEMPTS) {
          console.log(`⏳ Retrying in ${RETRY_DELAY_MS}ms...`);
          await sleep(RETRY_DELAY_MS * attempt); // Exponential backoff
        } else {
          console.error('❌ All retry attempts failed. Saving to localStorage only.');
          // Still save to localStorage as backup
          this.addToCache(result);
          this.saveToLocalStorage(this.cachedResults);
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Add result to local cache
   */
  private addToCache(result: QuizResult): void {
    // Remove existing result with same sessionId
    this.cachedResults = this.cachedResults.filter(r => r.sessionId !== result.sessionId);
    // Add new result at the beginning
    this.cachedResults.unshift(result);
    // Keep only last 100
    this.cachedResults = this.cachedResults.slice(0, 100);
  }

  /**
   * GET all student results from Firebase
   * 
   * @returns Promise<QuizResult[]> - Array of all student results
   */
  async getAllResults(): Promise<QuizResult[]> {
    console.log('🔍 Fetching all student results from Firebase...');

    try {
      const resultsRef = collection(db, COLLECTIONS.ATTEMPTS);
      const snapshot = await getDocs(resultsRef);

      console.log(`📦 Firebase returned ${snapshot.size} documents`);

      const results: QuizResult[] = [];
      
      // Fetch each result with its detailed subcollection
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const result = parseFirestoreResult(docSnapshot.id, data);
        
        // If this result has detailed results in subcollection, fetch them
        if (data.hasDetailedResults) {
          try {
            const detailsRef = collection(db, COLLECTIONS.ATTEMPTS, docSnapshot.id, 'details');
            const detailsSnapshot = await getDocs(detailsRef);
            
            const detailedResults: any[] = [];
            detailsSnapshot.forEach(detailDoc => {
              const detailData = detailDoc.data();
              detailedResults.push({
                questionId: detailData.questionId,
                question: detailData.question,
                options: detailData.options,
                imageUrl: detailData.imageUrl, // Images preserved!
                userAnswer: detailData.userAnswer,
                correctAnswer: detailData.correctAnswer,
                isCorrect: detailData.isCorrect,
                marksAwarded: detailData.marksAwarded
              });
            });
            
            // Sort by question number and add to result
            detailedResults.sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0));
            result.detailedResults = detailedResults;
            console.log(`📸 Loaded ${detailedResults.length} detailed results for ${result.studentName}`);
          } catch (detailError) {
            console.warn(`⚠️ Failed to load details for ${docSnapshot.id}:`, detailError);
          }
        }
        
        results.push(result);
      }

      // Sort by completedAt descending (newest first)
      results.sort((a, b) => b.completedAt - a.completedAt);

      // Update cache
      this.cachedResults = results;
      this.saveToLocalStorage(results);
      this.lastFetchTime = Date.now();

      console.log(`✅ Retrieved ${results.length} student results`);
      if (results.length > 0) {
        console.log('📊 Recent results:', results.slice(0, 3).map(r => `${r.studentName} - ${r.quizTitle}`));
      }

      return results;

    } catch (error: any) {
      console.error('❌ Failed to fetch results from Firebase:', error.message || error);
      console.log('📦 Returning cached results as fallback');
      return this.cachedResults;
    }
  }

  /**
   * GET cached results (instant, no network)
   */
  getCachedResults(): QuizResult[] {
    return [...this.cachedResults];
  }

  /**
   * SUBSCRIBE to real-time result updates
   * 
   * @param callback - Function called when results change
   * @returns Unsubscribe function
   */
  subscribeToResults(callback: (results: QuizResult[]) => void): () => void {
    console.log('🔄 Setting up real-time listener for student results...');

    try {
      const resultsRef = collection(db, COLLECTIONS.ATTEMPTS);
      
      const unsubscribe = onSnapshot(
        resultsRef,
        async (snapshot) => {
          console.log(`📡 Real-time update: ${snapshot.size} documents`);

          const results: QuizResult[] = [];
          
          // Fetch each result with its detailed subcollection
          for (const docSnapshot of snapshot.docs) {
            const data = docSnapshot.data();
            const result = parseFirestoreResult(docSnapshot.id, data);
            
            // If this result has detailed results in subcollection, fetch them
            if (data.hasDetailedResults) {
              try {
                const detailsRef = collection(db, COLLECTIONS.ATTEMPTS, docSnapshot.id, 'details');
                const detailsSnapshot = await getDocs(detailsRef);
                
                const detailedResults: any[] = [];
                detailsSnapshot.forEach(detailDoc => {
                  const detailData = detailDoc.data();
                  detailedResults.push({
                    questionId: detailData.questionId,
                    questionNumber: detailData.questionNumber,
                    question: detailData.question,
                    options: detailData.options,
                    imageUrl: detailData.imageUrl, // Images preserved!
                    userAnswer: detailData.userAnswer,
                    correctAnswer: detailData.correctAnswer,
                    isCorrect: detailData.isCorrect,
                    marksAwarded: detailData.marksAwarded
                  });
                });
                
                // Sort by question number
                detailedResults.sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0));
                result.detailedResults = detailedResults;
                console.log(`📸 Loaded ${detailedResults.length} detailed results for ${result.studentName}`);
              } catch (detailError) {
                console.warn(`⚠️ Failed to load details for ${docSnapshot.id}:`, detailError);
              }
            }
            
            results.push(result);
          }

          // Sort by completedAt descending
          results.sort((a, b) => b.completedAt - a.completedAt);

          // Update cache
          this.cachedResults = results;
          this.saveToLocalStorage(results);

          // Notify callback
          callback(results);
        },
        (error) => {
          console.error('❌ Real-time listener error:', error);
          // Return cached results on error
          callback(this.cachedResults);
        }
      );

      // Track active listener
      this.activeListeners.push(unsubscribe);

      console.log('✅ Real-time listener active');

      return () => {
        console.log('🧹 Unsubscribing from real-time updates');
        unsubscribe();
        this.activeListeners = this.activeListeners.filter(u => u !== unsubscribe);
      };

    } catch (error) {
      console.error('❌ Failed to set up real-time listener:', error);
      return () => {};
    }
  }

  /**
   * DELETE a single student result
   * 
   * @param sessionId - The session ID of the result to delete
   * @returns Promise<boolean> - true if deleted successfully
   */
  async deleteResult(sessionId: string): Promise<boolean> {
    console.log(`🗑️ Deleting result: ${sessionId}`);

    try {
      const docRef = doc(db, COLLECTIONS.ATTEMPTS, sessionId);
      await deleteDoc(docRef);

      // Remove from cache
      this.cachedResults = this.cachedResults.filter(r => r.sessionId !== sessionId);
      this.saveToLocalStorage(this.cachedResults);

      console.log('✅ Result deleted successfully');
      return true;

    } catch (error: any) {
      console.error('❌ Failed to delete result:', error.message || error);
      return false;
    }
  }

  /**
   * DELETE all student results
   * 
   * @returns Promise<{success: boolean, deletedCount: number}>
   */
  async deleteAllResults(): Promise<{ success: boolean; deletedCount: number }> {
    console.log('🗑️ Deleting ALL student results...');

    try {
      const resultsRef = collection(db, COLLECTIONS.ATTEMPTS);
      const snapshot = await getDocs(resultsRef);

      let deletedCount = 0;
      const deletePromises = snapshot.docs.map(async (docSnapshot) => {
        await deleteDoc(docSnapshot.ref);
        deletedCount++;
      });

      await Promise.all(deletePromises);

      // Clear cache
      this.cachedResults = [];
      this.saveToLocalStorage([]);

      console.log(`✅ Deleted ${deletedCount} results`);
      return { success: true, deletedCount };

    } catch (error: any) {
      console.error('❌ Failed to delete all results:', error.message || error);
      return { success: false, deletedCount: 0 };
    }
  }

  /**
   * GET a single result by session ID
   * 
   * @param sessionId - The session ID to look up
   * @returns Promise<QuizResult | null>
   */
  async getResultById(sessionId: string): Promise<QuizResult | null> {
    console.log(`🔍 Looking up result: ${sessionId}`);

    try {
      const docRef = doc(db, COLLECTIONS.ATTEMPTS, sessionId);
      const docSnapshot = await getDoc(docRef);

      if (docSnapshot.exists()) {
        const result = parseFirestoreResult(docSnapshot.id, docSnapshot.data());
        console.log('✅ Found result:', result.studentName, '-', result.quizTitle);
        return result;
      } else {
        console.log('⚠️ Result not found');
        return null;
      }

    } catch (error: any) {
      console.error('❌ Failed to get result:', error.message || error);
      // Try cache
      const cached = this.cachedResults.find(r => r.sessionId === sessionId);
      return cached || null;
    }
  }

  /**
   * Cleanup all active listeners
   */
  cleanup(): void {
    console.log('🧹 Cleaning up StudentResultsService...');
    this.activeListeners.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (e) {
        // Ignore cleanup errors
      }
    });
    this.activeListeners = [];
    console.log('✅ Cleanup complete');
  }

  /**
   * Check if Firebase is accessible
   */
  async checkConnection(): Promise<boolean> {
    try {
      const resultsRef = collection(db, COLLECTIONS.ATTEMPTS);
      await getDocs(query(resultsRef));
      return true;
    } catch (error) {
      console.error('❌ Firebase connection check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const StudentResultsService = StudentResultsServiceClass.getInstance();
export default StudentResultsService;
