// Enhanced Cloud Sync Service for Unlimited Questions
// Uses Firebase Storage for images + Firestore subcollections for questions

import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { db, COLLECTIONS, auth } from '../config/firebase';
import { SavedQuiz } from '../types';

export class EnhancedCloudSync {

  private static isAuthenticated(): boolean {
    return auth.currentUser !== null;
  }

  /**
   * Recursively remove all `undefined` values from an object/array.
   * Firestore's setDoc() throws "Unsupported field value: undefined"
   * if ANY value anywhere in the data tree is `undefined`.
   */
  private static sanitize(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Timestamp) return obj;    // preserve Firebase Timestamps
    if (Array.isArray(obj)) return obj.map(item => EnhancedCloudSync.sanitize(item));

    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = EnhancedCloudSync.sanitize(value);
      }
    }
    return clean;
  }

  /**
   * Split questions into size-aware chunks.
   * Each chunk accumulates questions until adding the next one would push the
   * serialised JSON past MAX_CHUNK_BYTES (800 KB – safe margin below Firestore's
   * 1 MB document limit).
   */
  private static buildChunks(questions: any[]): any[][] {
    const MAX_CHUNK_BYTES = 800 * 1024; // 800 KB per Firestore document
    const chunks: any[][] = [];
    let current: any[] = [];
    let currentBytes = 0;

    for (const q of questions) {
      const qBytes = new TextEncoder().encode(JSON.stringify(q)).length;

      if (current.length > 0 && currentBytes + qBytes > MAX_CHUNK_BYTES) {
        chunks.push(current);
        current = [];
        currentBytes = 0;
      }

      current.push(q);
      currentBytes += qBytes;
    }

    if (current.length > 0) chunks.push(current);
    return chunks;
  }

  static async saveQuizUnlimited(quiz: SavedQuiz): Promise<boolean> {
    try {
      console.log('💾 Saving quiz with ' + quiz.questions.length + ' questions');

      if (!this.isAuthenticated()) {
        console.warn('⚠️ Not authenticated! This may cause permission errors.');
      } else {
        console.log('✅ User authenticated:', auth.currentUser?.email || 'Admin');
      }

      // ─── Sanitize ALL question data (strip undefined values) ──────────────
      const sanitizedQuestions = EnhancedCloudSync.sanitize(quiz.questions);
      console.log(`🧹 Sanitized ${sanitizedQuestions.length} questions (removed undefined values)`);

      // ─── Build size-aware chunks ───────────────────────────────────────────
      const chunks = EnhancedCloudSync.buildChunks(sanitizedQuestions);

      const questionsWithImages = sanitizedQuestions.filter((q: any) => q.imageUrl || (q.imageUrls && q.imageUrls.length > 0));
      console.log(`📦 Creating ${chunks.length} size-aware chunks for ${sanitizedQuestions.length} questions`);
      console.log(`🖼️  ${questionsWithImages.length} questions have images`);
      chunks.forEach((c: any[], idx: number) => {
        const kb = (new TextEncoder().encode(JSON.stringify(c)).length / 1024).toFixed(1);
        console.log(`   Chunk ${idx + 1}: ${c.length} questions, ~${kb} KB`);
      });

      // ─── SAFE SAVE: write new chunks with temp prefix first ───────────────
      const tempPrefix = `temp_${Date.now()}_`;
      console.log(`📦 Writing ${chunks.length} chunks to Firebase (temp phase)...`);

      for (let i = 0; i < chunks.length; i++) {
        const chunkDocRef = doc(
          db, COLLECTIONS.QUIZZES, quiz.id, 'questions', `${tempPrefix}chunk_${i}`
        );
        const chunkData = EnhancedCloudSync.sanitize({
          chunkIndex: i,
          questions: chunks[i],
          createdAt: Timestamp.now()
        });
        try {
          await setDoc(chunkDocRef, chunkData);
          console.log(`✅ Temp chunk ${i + 1}/${chunks.length} saved (${chunks[i].length} questions)`);
        } catch (chunkError: any) {
          const kb = (new TextEncoder().encode(JSON.stringify(chunks[i])).length / 1024).toFixed(1);
          console.error(`❌ Chunk ${i + 1} failed (${kb} KB):`, chunkError.message);
          throw new Error(
            `Chunk ${i + 1} is too large for Firebase (~${kb} KB). ` +
            `Please reduce the number or size of images in questions ` +
            `${i * chunks[i].length + 1}–${(i + 1) * chunks[i].length}.`
          );
        }
      }

      // ─── Delete OLD chunks ─────────────────────────────────────────────────
      const questionsCollectionRef = collection(db, COLLECTIONS.QUIZZES, quiz.id, 'questions');
      const existingChunks = await getDocs(questionsCollectionRef);
      const oldChunks = existingChunks.docs.filter(d => !d.id.startsWith(tempPrefix));
      console.log(`🗑️  Deleting ${oldChunks.length} old chunk(s)...`);
      await Promise.all(oldChunks.map(d => deleteDoc(d.ref)));
      console.log('✅ Old chunks deleted');

      // ─── Rename temp chunks → final names ────────────────────────────────
      console.log('📝 Finalising chunk names...');
      for (let i = 0; i < chunks.length; i++) {
        const tempDocRef = doc(
          db, COLLECTIONS.QUIZZES, quiz.id, 'questions', `${tempPrefix}chunk_${i}`
        );
        const finalDocRef = doc(
          db, COLLECTIONS.QUIZZES, quiz.id, 'questions', `chunk_${i}`
        );
        const finalChunkData = EnhancedCloudSync.sanitize({
          chunkIndex: i,
          questions: chunks[i],
          createdAt: Timestamp.now()
        });
        await setDoc(finalDocRef, finalChunkData);
        await deleteDoc(tempDocRef);
      }

      // ─── Write metadata LAST (sanitized) ──────────────────────────────────
      const metadata = EnhancedCloudSync.sanitize({
        id: quiz.id,
        title: quiz.title || 'Untitled Quiz',
        description: quiz.description || '',
        subject: quiz.subject || null,
        chapters: quiz.chapters || null,
        createdAt: quiz.createdAt || Date.now(),
        defaultTimerMinutes: quiz.defaultTimerMinutes || 30,
        questionCount: sanitizedQuestions.length,
        published: quiz.published !== undefined ? quiz.published : false,
        publishedAt: quiz.published ? Timestamp.now() : null,
        lastModified: Timestamp.now(),
        usesFirebaseStorage: true,
        usesSubcollections: true,
        createdBy: auth.currentUser?.email || 'admin'
      });
      const quizDocRef = doc(db, COLLECTIONS.QUIZZES, quiz.id);
      await setDoc(quizDocRef, metadata, { merge: false });
      console.log(`🎉 Quiz saved! ${sanitizedQuestions.length} questions in ${chunks.length} chunk(s).`);
      return true;
    } catch (error: any) {
      console.error('❌ Failed to save quiz:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);

      if (error.code === 'permission-denied') {
        throw new Error(
          'Firebase permission denied. Please check Firebase Console Rules and try logging in again.'
        );
      } else if (error.code === 'unavailable') {
        throw new Error('Firebase is temporarily unavailable. Please check your internet connection.');
      } else {
        throw new Error('Failed to save quiz: ' + error.message);
      }
    }
  }

  static async loadQuizUnlimited(quizId: string): Promise<SavedQuiz | null> {
    try {
      console.log('📚 Loading quiz: ' + quizId);

      const quizDocRef = doc(db, COLLECTIONS.QUIZZES, quizId);
      const metadataSnap = await getDoc(quizDocRef);

      if (!metadataSnap.exists()) {
        console.error('❌ Quiz not found:', quizId);
        return null;
      }

      const metadata = metadataSnap.data();
      console.log('📝 Metadata loaded: ' + metadata.title);

      const questionsCollectionRef = collection(db, COLLECTIONS.QUIZZES, quizId, 'questions');
      const chunksSnap = await getDocs(questionsCollectionRef);

      console.log('📦 Found ' + chunksSnap.docs.length + ' chunks');

      const chunks = chunksSnap.docs
        .filter(d => !d.id.startsWith('temp_')) // Ignore in-progress save docs
        .map(d => d.data())
        .sort((a, b) => a.chunkIndex - b.chunkIndex);

      const questions = chunks.flatMap(chunk => chunk.questions || []);

      // Log image status for debugging
      const questionsWithImages = questions.filter((q: any) => q.imageUrl);
      console.log('✅ Loaded ' + questions.length + ' questions');
      console.log('🖼️ Questions with images:', questionsWithImages.length);

      if (questionsWithImages.length > 0) {
        const firstImageQ = questionsWithImages[0];
        const imgPreview = firstImageQ.imageUrl?.substring(0, 50);
        console.log('🔍 First image URL preview:', imgPreview + '...');
      }

      return {
        ...metadata,
        questions
      } as SavedQuiz;
    } catch (error: any) {
      console.error('❌ Failed to load quiz:', error);
      return null;
    }
  }
}
