// Firebase Cloud Sync Service - Real-time data synchronization
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  where,
  addDoc,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { db, COLLECTIONS } from '../config/firebase';
import { QuizQuestion, SavedQuiz, QuizResult, StudentInfo } from '../types';
import {
  ensureQuizWithinLimit,
  calculateQuizSizeKB,
  getHumanReadableSize,
  calculateQuizSize
} from '../utils/imageCompression';
import CloudinaryService from './CloudinaryService';
import { EnhancedCloudSync } from './EnhancedCloudSync';
import { indexedDBStorage } from '../utils/indexedDB';

// Quiz interface extended for Firebase
interface FirebaseQuiz extends SavedQuiz {
  firebaseId?: string;
  synced?: boolean;
  lastModified?: any;
  createdBy?: string;
  published?: boolean;
  publishedAt?: any;
}

// User interface for Firebase
interface FirebaseUser extends StudentInfo {
  firebaseId?: string;
  fcmToken?: string;
  lastTokenUpdate?: any;
  lastLogin?: any;
  createdAt?: any;
  role?: 'admin' | 'student';
}

// Quiz attempt interface
interface QuizAttempt {
  id?: string;
  quizId: string;
  userId: string;
  answers: { [questionId: string]: string };
  score: number;
  percentage: number;
  submittedAt?: any;
  timeTaken: number;
}

export class CloudSyncService {
  private static instance: CloudSyncService;
  private syncInProgress = false;
  private realTimeListeners: (() => void)[] = [];

  static getInstance(): CloudSyncService {
    if (!CloudSyncService.instance) {
      CloudSyncService.instance = new CloudSyncService();
    }
    return CloudSyncService.instance;
  }

  // ===== QUIZ SYNC OPERATIONS =====

  // Save quiz to Firebase
  async saveQuiz(quiz: SavedQuiz, userId: string): Promise<{ success: boolean; firebaseId?: string; message: string }> {
    try {
      this.syncInProgress = true;

      const firebaseQuiz: FirebaseQuiz = {
        ...quiz,
        createdBy: userId,
        lastModified: serverTimestamp(),
        synced: true,
        published: false
      };

      // If quiz has an ID, update it; otherwise create new
      let docRef;
      if (quiz.id && quiz.id.startsWith('firebase_')) {
        const firebaseId = quiz.id.replace('firebase_', '');
        docRef = doc(db, COLLECTIONS.QUIZZES, firebaseId);
        await setDoc(docRef, firebaseQuiz, { merge: true });
      } else {
        docRef = await addDoc(collection(db, COLLECTIONS.QUIZZES), firebaseQuiz);
      }

      console.log('✅ Quiz saved to Firebase:', docRef.id);

      return {
        success: true,
        firebaseId: docRef.id,
        message: 'Quiz saved to cloud successfully'
      };
    } catch (error) {
      console.error('❌ Error saving quiz to Firebase:', error);
      return {
        success: false,
        message: 'Failed to save quiz to cloud'
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  // Toggle quiz publish status
  async togglePublishStatus(quizId: string, shouldPublish: boolean): Promise<{ success: boolean; message: string }> {
    try {
      // Remove 'firebase_' prefix if present
      const firebaseId = quizId.startsWith('firebase_') ? quizId.replace('firebase_', '') : quizId;
      const docRef = doc(db, COLLECTIONS.QUIZZES, firebaseId);

      if (shouldPublish) {
        // PUBLISHING: Read the quiz, shuffle questions, save shuffled order
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          return { success: false, message: 'Quiz not found in Firebase' };
        }

        const quizData = docSnap.data();
        const questions = quizData.questions || [];

        // Store original order as array of question IDs (lightweight)
        const originalQuestionOrder = questions.map((q: any) => q.id);

        // Fisher-Yates shuffle on a copy
        const shuffledQuestions = [...questions];
        for (let i = shuffledQuestions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledQuestions[i], shuffledQuestions[j]] = [shuffledQuestions[j], shuffledQuestions[i]];
        }

        console.log('🔀 Questions shuffled for publishing. Original order saved.');
        console.log(`📊 Total questions: ${shuffledQuestions.length}`);

        await updateDoc(docRef, {
          questions: shuffledQuestions,
          originalQuestionOrder: originalQuestionOrder,
          published: true,
          publishedAt: serverTimestamp(),
          lastModified: serverTimestamp()
        });
      } else {
        // UNPUBLISHING: Restore original question order if available
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const quizData = docSnap.data();
          const originalOrder: string[] = quizData.originalQuestionOrder || [];
          const questions = quizData.questions || [];

          if (originalOrder.length > 0 && questions.length > 0) {
            // Restore original order by sorting questions based on originalQuestionOrder
            const questionMap = new Map(questions.map((q: any) => [q.id, q]));
            const restoredQuestions = originalOrder
              .map((id: string) => questionMap.get(id))
              .filter((q: any) => q !== undefined);

            // If some questions were added/removed, append any that weren't in the original order
            const restoredIds = new Set(originalOrder);
            const extraQuestions = questions.filter((q: any) => !restoredIds.has(q.id));
            const finalQuestions = [...restoredQuestions, ...extraQuestions];

            console.log('🔄 Restoring original question order on unpublish');

            await updateDoc(docRef, {
              questions: finalQuestions,
              published: false,
              publishedAt: null,
              lastModified: serverTimestamp()
            });
          } else {
            await updateDoc(docRef, {
              published: false,
              publishedAt: null,
              lastModified: serverTimestamp()
            });
          }
        } else {
          await updateDoc(docRef, {
            published: false,
            publishedAt: null,
            lastModified: serverTimestamp()
          });
        }
      }

      console.log(`✅ Quiz ${shouldPublish ? 'published' : 'unpublished'} successfully:`, firebaseId);

      return {
        success: true,
        message: `Quiz ${shouldPublish ? 'published (questions shuffled!)' : 'unpublished (original order restored)'} successfully`
      };
    } catch (error) {
      console.error('❌ Error toggling publish status:', error);
      return {
        success: false,
        message: 'Failed to update quiz status'
      };
    }
  }

  // Get all quizzes from Firebase (admin view - includes drafts)
  async getAllQuizzes(userId?: string): Promise<FirebaseQuiz[]> {
    try {
      let q = query(
        collection(db, COLLECTIONS.QUIZZES),
        orderBy('lastModified', 'desc')
      );

      // If user ID provided, filter by creator (for admin)
      if (userId) {
        q = query(
          collection(db, COLLECTIONS.QUIZZES),
          where('createdBy', '==', userId),
          orderBy('lastModified', 'desc')
        );
      }

      const snapshot = await getDocs(q);
      const quizzes = snapshot.docs.map(doc => ({
        id: `firebase_${doc.id}`,
        firebaseId: doc.id,
        ...doc.data()
      })) as FirebaseQuiz[];

      console.log('📥 Retrieved quizzes from Firebase:', quizzes.length);
      return quizzes;
    } catch (error) {
      console.error('❌ Error getting quizzes from Firebase:', error);
      return [];
    }
  }

  // Get published quizzes for students
  async getPublishedQuizzes(classroomId: string = 'default'): Promise<SavedQuiz[]> {
    try {
      console.log('🔍 Querying Firebase for published quizzes...');
      // Remove orderBy to avoid index requirement - we'll sort in memory
      const q = query(
        collection(db, COLLECTIONS.QUIZZES),
        where('published', '==', true)
      );

      const snapshot = await getDocs(q);
      console.log('📦 Firebase returned', snapshot.docs.length, 'published documents');

      const quizzes: SavedQuiz[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        console.log('📄 Processing quiz:', data.title, 'ID:', docSnap.id, 'Published:', data.published);

        // Check if quiz uses subcollections (new format for unlimited questions)
        if (data.usesSubcollections) {
          console.log('🔄 Loading quiz with subcollections:', data.title);
          try {
            const fullQuiz = await EnhancedCloudSync.loadQuizUnlimited(docSnap.id);
            if (fullQuiz) {
              quizzes.push(fullQuiz);
              console.log(`✅ Loaded ${fullQuiz.questions.length} questions from subcollections`);
            }
          } catch (error) {
            console.error('❌ Error loading quiz from subcollections:', error);
          }
        } else {
          // Old format - questions stored directly in document
          quizzes.push({
            id: data.id || docSnap.id,
            title: data.title,
            description: data.description,
            questions: data.questions,
            createdAt: data.createdAt,
            defaultTimerMinutes: data.defaultTimerMinutes
          } as SavedQuiz);
        }
      }

      // Sort by createdAt descending (newest first) in memory
      quizzes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      console.log('📚 Retrieved and sorted published quizzes:', quizzes.length);
      console.log('📋 Quiz titles:', quizzes.map(q => q.title));
      return quizzes;
    } catch (error) {
      console.error('❌ Error getting published quizzes:', error);
      console.error('Error code:', (error as any).code);
      console.error('Error message:', (error as any).message);
      return [];
    }
  }

  // Publish quiz
  async publishQuiz(quizId: string): Promise<{ success: boolean; message: string }> {
    try {
      const firebaseId = quizId.replace('firebase_', '');
      const docRef = doc(db, COLLECTIONS.QUIZZES, firebaseId);

      await updateDoc(docRef, {
        published: true,
        publishedAt: serverTimestamp(),
        lastModified: serverTimestamp()
      });

      console.log('📢 Quiz published successfully:', quizId);

      return {
        success: true,
        message: 'Quiz published successfully'
      };
    } catch (error) {
      console.error('❌ Error publishing quiz:', error);
      return {
        success: false,
        message: 'Failed to publish quiz'
      };
    }
  }

  // Unpublish quiz
  async unpublishQuiz(quizId: string): Promise<{ success: boolean; message: string }> {
    try {
      const firebaseId = quizId.replace('firebase_', '');
      const docRef = doc(db, COLLECTIONS.QUIZZES, firebaseId);

      await updateDoc(docRef, {
        published: false,
        publishedAt: null,
        lastModified: serverTimestamp()
      });

      console.log('🔒 Quiz unpublished:', quizId);

      return {
        success: true,
        message: 'Quiz unpublished successfully'
      };
    } catch (error) {
      console.error('❌ Error unpublishing quiz:', error);
      return {
        success: false,
        message: 'Failed to unpublish quiz'
      };
    }
  }

  // Delete quiz from Firebase
  async deleteQuiz(quizId: string): Promise<{ success: boolean; message: string }> {
    try {
      const firebaseId = quizId.replace('firebase_', '');
      await deleteDoc(doc(db, COLLECTIONS.QUIZZES, firebaseId));

      console.log('🗑️ Quiz deleted from Firebase:', quizId);

      return {
        success: true,
        message: 'Quiz deleted successfully'
      };
    } catch (error) {
      console.error('❌ Error deleting quiz:', error);
      return {
        success: false,
        message: 'Failed to delete quiz'
      };
    }
  }

  // ===== LEGACY SUPPORT FOR SAVED QUIZ =====

  // Save quiz to cloud (legacy method)
  async saveQuizToCloud(quiz: SavedQuiz, classroomId: string = 'default'): Promise<boolean> {
    try {
      console.log('🔥 Saving quiz to Firebase:', quiz.title, 'ID:', quiz.id);

      // Check quiz size BEFORE compression
      const originalSize = calculateQuizSize(quiz);
      const originalSizeKB = calculateQuizSizeKB(quiz);
      console.log(`� Original quiz size: ${getHumanReadableSize(originalSize)} (${originalSizeKB.toFixed(2)} KB)`);

      // Compress images if quiz is too large (optimized for 50 images)
      const compressionResult = await ensureQuizWithinLimit(quiz);
      const processedQuiz = compressionResult.quiz;

      if (compressionResult.compressed) {
        console.log(`✨ Images compressed (optimized for 50 images per quiz)!`);
        console.log(`📉 Size reduced by ${getHumanReadableSize(compressionResult.originalSize - compressionResult.finalSize)}`);

        // Show user-friendly message
        if (compressionResult.withinLimit) {
          alert(`✅ Quiz saved successfully!\n\n` +
            `Original: ${getHumanReadableSize(compressionResult.originalSize)}\n` +
            `Optimized: ${getHumanReadableSize(compressionResult.finalSize)}\n\n` +
            `✨ Images compressed with 75% quality\n` +
            `📸 Supports up to 50 images per quiz\n` +
            `✓ Text and diagrams remain clear and readable`);
        } else {
          alert(`⚠️ Quiz exceeds 1 MB limit even after compression!\n\n` +
            `Current size: ${getHumanReadableSize(compressionResult.finalSize)}\n\n` +
            `Please:\n` +
            `• Reduce number of images (max 50 recommended)\n` +
            `• Split into multiple quizzes\n` +
            `• Use smaller/simpler images\n\n` +
            `Quiz saved locally only.`);
          console.error('❌ Quiz exceeds Firebase size limit even after compression');
          return false;
        }
      }

      // Final size check
      if (!compressionResult.withinLimit) {
        const finalSize = calculateQuizSize(processedQuiz);
        alert(`❌ Cannot save quiz to Firebase: Size limit exceeded!\n\n` +
          `Quiz size: ${getHumanReadableSize(finalSize)}\n` +
          `Firebase limit: 1 MB (1,048,576 bytes)\n\n` +
          `Please:\n` +
          `• Use fewer images\n` +
          `• Use smaller images\n` +
          `• Reduce image quality\n\n` +
          `Quiz saved locally only.`);
        return false;
      }

      console.log('🔑 Firebase collection:', COLLECTIONS.QUIZZES);
      console.log('🌐 Firebase db initialized:', db ? 'YES' : 'NO');

      const quizDoc = doc(db, COLLECTIONS.QUIZZES, processedQuiz.id);
      console.log('📄 Document reference created for:', processedQuiz.id);

      const dataToSave = {
        ...processedQuiz,
        publishedAt: Timestamp.now(),
        published: true
      };

      await setDoc(quizDoc, dataToSave);
      console.log('✅ Quiz saved to Firebase successfully:', processedQuiz.title);
      console.log('🎉 You can verify in Firebase Console: https://console.firebase.google.com/project/quiz-web-app-109af/firestore/data/quizzes/' + processedQuiz.id);
      return true;
    } catch (error) {
      console.error('❌ Firebase Error - Failed to save quiz:', error);
      console.error('📋 Quiz ID attempted:', quiz.id);
      console.error('📋 Quiz title:', quiz.title);
      console.error('🔴 Error type:', (error as any).constructor?.name);
      console.error('🔴 Error message:', (error as any).message);
      console.error('🔴 Error code:', (error as any).code);
      console.error('🔴 Full error:', error);

      // Better error message for size limit
      if ((error as any).message?.includes('maximum allowed size')) {
        alert('❌ Quiz is too large for Firebase!\n\n' +
          'The quiz has too many or too large images.\n\n' +
          'Solutions:\n' +
          '• Use fewer images\n' +
          '• Use smaller image files\n' +
          '• Compress images before uploading\n\n' +
          'Quiz saved locally only.');
      } else {
        alert('❌ CRITICAL: Failed to save quiz to Firebase!\n\nError: ' + (error as any).message + '\n\nQuiz saved locally only. Please check console for details.');
      }
      return false;
    }
  }

  // Delete quiz from cloud (legacy method)
  async deleteQuizFromCloud(quizId: string, classroomId: string = 'default'): Promise<boolean> {
    try {
      const quizDoc = doc(db, COLLECTIONS.QUIZZES, quizId);
      await deleteDoc(quizDoc);
      console.log('Quiz deleted from cloud');
      return true;
    } catch (error) {
      console.error('Error deleting quiz from cloud:', error);
      return false;
    }
  }

  // ===== USER SYNC OPERATIONS =====

  // Save user profile to Firebase
  async saveUser(user: StudentInfo): Promise<{ success: boolean; message: string }> {
    try {
      const userId = user.id || user.sessionId || `user_${Date.now()}`;
      const firebaseUser: FirebaseUser = {
        ...user,
        id: userId,
        lastLogin: serverTimestamp(),
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, COLLECTIONS.USERS, userId), firebaseUser, { merge: true });

      console.log('✅ User saved to Firebase:', user.id);

      return {
        success: true,
        message: 'User profile saved'
      };
    } catch (error) {
      console.error('❌ Error saving user:', error);
      return {
        success: false,
        message: 'Failed to save user profile'
      };
    }
  }

  // Get user from Firebase
  async getUser(userId: string): Promise<FirebaseUser | null> {
    try {
      const docRef = doc(db, COLLECTIONS.USERS, userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as FirebaseUser;
      } else {
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting user:', error);
      return null;
    }
  }

  // ===== QUIZ ATTEMPT SYNC =====

  // Save quiz attempt to Firebase
  async saveQuizAttempt(attempt: QuizAttempt): Promise<{ success: boolean; message: string }> {
    try {
      const attemptData = {
        ...attempt,
        submittedAt: serverTimestamp(),
        synced: true
      };

      await addDoc(collection(db, COLLECTIONS.ATTEMPTS), attemptData);

      console.log('✅ Quiz attempt saved to Firebase');

      return {
        success: true,
        message: 'Quiz attempt saved'
      };
    } catch (error) {
      console.error('❌ Error saving attempt:', error);
      return {
        success: false,
        message: 'Failed to save quiz attempt'
      };
    }
  }

  // Save student result to cloud
  async saveStudentResult(result: QuizResult, classroomId: string = 'default'): Promise<boolean> {
    try {
      console.log('💾 Saving student result to Firebase...');
      console.log('📊 Result data:', result);
      console.log('🎯 Collection:', COLLECTIONS.ATTEMPTS);
      console.log('🔑 Document ID:', result.sessionId);

      const resultDoc = doc(db, COLLECTIONS.ATTEMPTS, result.sessionId);
      const dataToSave = {
        ...result,
        submittedAt: Timestamp.now()
      };

      console.log('📝 Data to save:', dataToSave);
      await setDoc(resultDoc, dataToSave);

      console.log('✅ Student result saved to cloud successfully!');
      return true;
    } catch (error) {
      console.error('❌ Error saving student result to cloud:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return false;
    }
  }

  // Get quiz attempts for a user
  async getUserAttempts(userId: string): Promise<QuizAttempt[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.ATTEMPTS),
        where('userId', '==', userId),
        orderBy('submittedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const attempts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as QuizAttempt[];

      console.log('📊 Retrieved user attempts:', attempts.length);
      return attempts;
    } catch (error) {
      console.error('❌ Error getting user attempts:', error);
      return [];
    }
  }

  // Helper function to convert Firebase Timestamp to number
  private convertTimestamp(value: any): number {
    if (!value) return Date.now();
    // If it's a Firebase Timestamp object
    if (value && typeof value === 'object' && 'toMillis' in value) {
      return value.toMillis();
    }
    // If it's a Firestore Timestamp with seconds/nanoseconds
    if (value && typeof value === 'object' && 'seconds' in value) {
      return value.seconds * 1000 + (value.nanoseconds || 0) / 1000000;
    }
    // If it's already a number
    if (typeof value === 'number') {
      return value;
    }
    // If it's a string, try to parse it
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return isNaN(parsed) ? Date.now() : parsed;
    }
    return Date.now();
  }

  // Get all student results from cloud
  async getStudentResults(classroomId: string = 'default'): Promise<QuizResult[]> {
    try {
      console.log('🔍 Fetching student results from Firebase collection:', COLLECTIONS.ATTEMPTS);
      const resultsRef = collection(db, COLLECTIONS.ATTEMPTS);

      // Try without orderBy first (to avoid index issues)
      const snapshot = await getDocs(resultsRef);
      console.log('📦 Firebase snapshot received, doc count:', snapshot.size);

      const results: QuizResult[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        console.log('📄 Processing document:', docSnapshot.id);
        console.log('📄 Raw data:', JSON.stringify(data, null, 2));

        // Convert timestamp properly
        const completedAt = this.convertTimestamp(data.completedAt);

        console.log('📄 Converted completedAt:', completedAt, 'from:', data.completedAt);

        results.push({
          sessionId: data.sessionId || docSnapshot.id,
          categoryName: data.categoryName || 'Unknown',
          quizTitle: data.quizTitle || 'Unknown Quiz',
          studentName: data.studentName || 'Anonymous',
          studentEmail: data.studentEmail || '',
          totalQuestions: data.totalQuestions || 0,
          correctAnswers: data.correctAnswers || 0,
          incorrectAnswers: data.incorrectAnswers || 0,
          skippedQuestions: data.skippedQuestions || 0,
          score: data.score || 0,
          percentage: data.percentage || 0,
          totalMarks: data.totalMarks || 0,
          maxMarks: data.maxMarks || 0,
          timeTaken: data.timeTaken || 0,
          completedAt: completedAt,
          detailedResults: data.detailedResults || []
        });
      });

      // Sort by completedAt descending (most recent first)
      results.sort((a, b) => b.completedAt - a.completedAt);

      console.log('✅ Fetched student results from cloud:', results.length);
      if (results.length > 0) {
        console.log('📊 First result:', results[0].studentName, '-', results[0].quizTitle);
        console.log('📊 Quiz titles found:', Array.from(new Set(results.map(r => r.quizTitle))));
      }
      return results;
    } catch (error) {
      console.error('❌ Error fetching student results from cloud:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return [];
    }
  }

  // Delete a single student result from Firebase
  async deleteStudentResult(sessionId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🗑️ Deleting student result from Firebase:', sessionId);
      const resultDoc = doc(db, COLLECTIONS.ATTEMPTS, sessionId);
      await deleteDoc(resultDoc);
      console.log('✅ Student result deleted from Firebase');
      return {
        success: true,
        message: 'Result deleted successfully'
      };
    } catch (error) {
      console.error('❌ Error deleting student result from Firebase:', error);
      return {
        success: false,
        message: 'Failed to delete result from Firebase'
      };
    }
  }

  // Delete all student results from Firebase
  async clearAllStudentResults(): Promise<{ success: boolean; message: string; deletedCount: number }> {
    try {
      console.log('🗑️ Clearing all student results from Firebase...');
      const resultsRef = collection(db, COLLECTIONS.ATTEMPTS);
      const snapshot = await getDocs(resultsRef);

      let deletedCount = 0;
      const deletePromises = snapshot.docs.map(async (docSnapshot) => {
        await deleteDoc(docSnapshot.ref);
        deletedCount++;
      });

      await Promise.all(deletePromises);

      console.log(`✅ Deleted ${deletedCount} student results from Firebase`);
      return {
        success: true,
        message: `Successfully deleted ${deletedCount} results`,
        deletedCount
      };
    } catch (error) {
      console.error('❌ Error clearing student results from Firebase:', error);
      return {
        success: false,
        message: 'Failed to clear results from Firebase',
        deletedCount: 0
      };
    }
  }

  // Get quiz attempts for a specific quiz
  async getQuizAttempts(quizId: string): Promise<QuizAttempt[]> {
    try {
      const firebaseQuizId = quizId.replace('firebase_', '');
      const q = query(
        collection(db, COLLECTIONS.ATTEMPTS),
        where('quizId', '==', firebaseQuizId),
        orderBy('submittedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const attempts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as QuizAttempt[];

      console.log(`📈 Retrieved attempts for quiz ${quizId}:`, attempts.length);
      return attempts;
    } catch (error) {
      console.error('❌ Error getting quiz attempts:', error);
      return [];
    }
  }

  // ===== REAL-TIME LISTENERS =====

  // Listen to published quizzes (for students)
  onPublishedQuizzesChange(callback: (quizzes: FirebaseQuiz[]) => void): () => void {
    const q = query(
      collection(db, COLLECTIONS.QUIZZES),
      where('published', '==', true),
      orderBy('publishedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const quizzes = snapshot.docs.map(doc => ({
        id: `firebase_${doc.id}`,
        firebaseId: doc.id,
        ...doc.data()
      })) as FirebaseQuiz[];

      console.log('🔄 Real-time published quizzes update:', quizzes.length);
      callback(quizzes);
    });

    this.realTimeListeners.push(unsubscribe);
    return unsubscribe;
  }

  // Listen to all quizzes (for admin)
  onAllQuizzesChange(userId: string, callback: (quizzes: FirebaseQuiz[]) => void): () => void {
    const q = query(
      collection(db, COLLECTIONS.QUIZZES),
      where('createdBy', '==', userId),
      orderBy('lastModified', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const quizzes = snapshot.docs.map(doc => ({
        id: `firebase_${doc.id}`,
        firebaseId: doc.id,
        ...doc.data()
      })) as FirebaseQuiz[];

      console.log('🔄 Real-time admin quizzes update:', quizzes.length);
      callback(quizzes);
    });

    this.realTimeListeners.push(unsubscribe);
    return unsubscribe;
  }

  // Listen to student results changes (for real-time updates)
  onStudentResultsChange(callback: (results: QuizResult[]) => void): () => void {
    const resultsRef = collection(db, COLLECTIONS.ATTEMPTS);

    const unsubscribe = onSnapshot(resultsRef, (snapshot) => {
      const results: QuizResult[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();

        // Convert timestamp properly using helper
        const completedAt = this.convertTimestamp(data.completedAt);

        results.push({
          sessionId: data.sessionId || docSnapshot.id,
          categoryName: data.categoryName || 'Unknown',
          quizTitle: data.quizTitle || 'Unknown Quiz',
          studentName: data.studentName || 'Anonymous',
          studentEmail: data.studentEmail || '',
          totalQuestions: data.totalQuestions || 0,
          correctAnswers: data.correctAnswers || 0,
          incorrectAnswers: data.incorrectAnswers || 0,
          skippedQuestions: data.skippedQuestions || 0,
          score: data.score || 0,
          percentage: data.percentage || 0,
          totalMarks: data.totalMarks || 0,
          maxMarks: data.maxMarks || 0,
          timeTaken: data.timeTaken || 0,
          completedAt: completedAt,
          detailedResults: data.detailedResults || []
        });
      });

      // Sort by completedAt descending
      results.sort((a, b) => b.completedAt - a.completedAt);

      console.log('🔄 Real-time student results update:', results.length);
      if (results.length > 0) {
        console.log('📊 Quiz titles in real-time update:', Array.from(new Set(results.map(r => r.quizTitle))));
      }
      callback(results);
    }, (error) => {
      console.error('❌ Real-time listener error:', error);
    });

    this.realTimeListeners.push(unsubscribe);
    return unsubscribe;
  }

  // Listen for ALL quiz updates (for admin - includes drafts)
  subscribeToAllQuizzes(
    callback: (quizzes: SavedQuiz[]) => void
  ): () => void {
    try {
      console.log('🔄 [ADMIN] Setting up real-time quiz listener (ALL quizzes)...');
      const quizzesRef = collection(db, COLLECTIONS.QUIZZES);
      // NO filter - admin sees all quizzes (published AND drafts)
      const q = query(quizzesRef);

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        console.log(`📦 [ADMIN] Real-time snapshot received: ${snapshot.size} total documents`);
        const quizzes: SavedQuiz[] = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          // Check if quiz uses subcollections (new format for unlimited questions)
          if (data.usesSubcollections) {
            console.log('🔄 [ADMIN] Loading quiz with subcollections:', data.title);
            try {
              const fullQuiz = await EnhancedCloudSync.loadQuizUnlimited(docSnap.id);
              if (fullQuiz) {
                quizzes.push(fullQuiz);
                console.log(`✅ Loaded ${fullQuiz.questions.length} questions from subcollections`);
              }
            } catch (error) {
              console.error('❌ Error loading quiz from subcollections:', error);
            }
          } else {
            // Old format - questions stored directly in document
            let quizQuestions = data.questions || [];

            // For admin: restore original question order if quiz is published (questions are shuffled in Firebase)
            if (data.published && data.originalQuestionOrder && data.originalQuestionOrder.length > 0) {
              const questionMap = new Map(quizQuestions.map((q: any) => [q.id, q]));
              const restored = data.originalQuestionOrder
                .map((id: string) => questionMap.get(id))
                .filter((q: any) => q !== undefined);
              // Append any extra questions not in original order
              const restoredIds = new Set(data.originalQuestionOrder);
              const extras = quizQuestions.filter((q: any) => !restoredIds.has(q.id));
              quizQuestions = [...restored, ...extras];
            }

            quizzes.push({
              id: data.id || docSnap.id,
              title: data.title,
              description: data.description,
              questions: quizQuestions,
              createdAt: data.createdAt,
              defaultTimerMinutes: data.defaultTimerMinutes,
              published: data.published
            });
          }
        }

        // Sort by createdAt descending (newest first)
        quizzes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        console.log('✅ [ADMIN] Real-time update:', quizzes.length, 'total quizzes');
        console.log('📋 Published:', quizzes.filter(q => q.published).length, '| Drafts:', quizzes.filter(q => !q.published).length);
        callback(quizzes);
      }, (error) => {
        console.error('❌ [ADMIN] Error in real-time listener:', error);
      });

      this.realTimeListeners.push(unsubscribe);
      console.log('✅ [ADMIN] Real-time listener set up successfully');
      return unsubscribe;
    } catch (error) {
      console.error('❌ [ADMIN] Error subscribing to quiz updates:', error);
      return () => { };
    }
  }

  // Listen for real-time quiz updates (for students - published only)
  subscribeToQuizUpdates(
    callback: (quizzes: SavedQuiz[]) => void,
    classroomId: string = 'default'
  ): () => void {
    try {
      console.log('🔄 [STUDENT] Setting up real-time quiz listener (published only)...');
      const quizzesRef = collection(db, COLLECTIONS.QUIZZES);
      // ✅ FIXED: Proper Firestore query filter (more efficient)
      const q = query(quizzesRef, where('published', '==', true));

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        console.log(`📦 Real-time snapshot received: ${snapshot.size} published documents`);
        const quizzes: SavedQuiz[] = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          // All documents are already published due to query filter
          // Check if quiz uses subcollections (new format for unlimited questions)
          if (data.usesSubcollections) {
            console.log('🔄 Real-time update: Loading quiz with subcollections:', data.title);
            try {
              const fullQuiz = await EnhancedCloudSync.loadQuizUnlimited(docSnap.id);
              if (fullQuiz) {
                quizzes.push(fullQuiz);
                console.log(`✅ Loaded ${fullQuiz.questions.length} questions from subcollections`);
              } else {
                console.error('❌ Subcollection loader returned null for quiz:', data.title, 'ID:', docSnap.id);
              }
            } catch (error) {
              console.error('❌ Error loading quiz from subcollections in real-time update:', error);
              console.error('Quiz ID:', docSnap.id, 'Title:', data.title);
            }
          } else {
            // Old format - questions stored directly in document
            quizzes.push({
              id: data.id || docSnap.id,
              title: data.title,
              description: data.description,
              questions: data.questions,
              createdAt: data.createdAt,
              defaultTimerMinutes: data.defaultTimerMinutes
            });
          }
        }

        // Sort by createdAt descending (newest first) in memory
        quizzes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        console.log('✅ Real-time quiz update:', quizzes.length, 'published quizzes');
        console.log('📋 Quiz titles:', quizzes.map(q => q.title));
        callback(quizzes);
      }, (error) => {
        console.error('❌ Error in real-time listener:', error);
      });

      this.realTimeListeners.push(unsubscribe);
      console.log('✅ Real-time listener set up successfully');
      return unsubscribe;
    } catch (error) {
      console.error('❌ Error subscribing to quiz updates:', error);
      return () => { };
    }
  }

  // ===== SYNC STATUS =====

  // Check if sync is in progress
  isSyncing(): boolean {
    return this.syncInProgress;
  }

  // Cleanup all listeners
  cleanup(): void {
    this.realTimeListeners.forEach(unsubscribe => unsubscribe());
    this.realTimeListeners = [];
    console.log('🧹 Cloud sync listeners cleaned up');
  }

  // ===== MIGRATION FROM LOCAL STORAGE =====

  // Sync local data to cloud (for teachers)
  async syncLocalToCloud(classroomId: string = 'default'): Promise<boolean> {
    try {
      // Get local saved quizzes
      const localQuizzes = JSON.parse(localStorage.getItem('quiz_master_saved_quizzes') || '[]');

      // Upload each quiz to cloud
      for (const quiz of localQuizzes) {
        await this.saveQuizToCloud(quiz, classroomId);
      }

      console.log('Local data synced to cloud');
      return true;
    } catch (error) {
      console.error('Error syncing local data to cloud:', error);
      return false;
    }
  }

  // Download cloud data to local (for students)
  async syncCloudToLocal(classroomId: string = 'default'): Promise<boolean> {
    try {
      console.log('🔍 Fetching quizzes from Firebase...');
      const cloudQuizzes = await this.getPublishedQuizzes(classroomId);

      console.log(`📊 Firebase returned ${cloudQuizzes.length} published quizzes`);
      console.log(`📋 Quiz titles:`, cloudQuizzes.map(q => q.title));

      // ✅ DON'T save to localStorage at all - it causes QuotaExceeded errors
      // Quizzes are kept in React state and fetched from Firebase on page load
      console.log('✅ Cloud sync complete - quizzes available in React state (not stored locally)');

      return true;
    } catch (error) {
      console.error('❌ Error syncing cloud data to local:', error);
      console.error('❌ Error details:', error);
      return false;
    }
  }

  // Migrate data from local storage to Firebase
  async migrateFromLocalStorage(localQuizzes: SavedQuiz[], userId: string): Promise<{ success: boolean; migrated: number; message: string }> {
    try {
      this.syncInProgress = true;
      let migratedCount = 0;

      for (const quiz of localQuizzes) {
        // Skip if already has Firebase ID
        if (quiz.id && quiz.id.startsWith('firebase_')) {
          continue;
        }

        const result = await this.saveQuiz(quiz, userId);
        if (result.success) {
          migratedCount++;
        }
      }

      console.log(`📦 Migration completed: ${migratedCount}/${localQuizzes.length} quizzes migrated`);

      return {
        success: true,
        migrated: migratedCount,
        message: `Successfully migrated ${migratedCount} quizzes to cloud`
      };
    } catch (error) {
      console.error('❌ Migration error:', error);
      return {
        success: false,
        migrated: 0,
        message: 'Failed to migrate data to cloud'
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  // Helper method to check if quiz uses Firebase Storage URLs
  private hasFirebaseStorageImages(quiz: SavedQuiz): boolean {
    // Check if any images are Firebase Storage URLs instead of base64
    const allImages: string[] = [];

    // Collect all image URLs from questions
    quiz.questions?.forEach(question => {
      if (question.imageUrl) allImages.push(question.imageUrl);
      if (question.options) {
        Object.values(question.options).forEach(option => {
          if (typeof option === 'string' && option.startsWith('http')) {
            allImages.push(option);
          }
        });
      }
    });

    // If any image is a Cloudinary URL, consider it as using cloud storage
    return allImages.some(img => CloudinaryService.isCloudinaryUrl(img));
  }
}

// Export singleton instance
export const cloudSyncService = CloudSyncService.getInstance();
export const cloudSync = CloudSyncService.getInstance(); // Legacy export
