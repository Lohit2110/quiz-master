// IndexedDB Storage - Much larger capacity than localStorage (50MB+)
import { SavedQuiz, QuizResult } from '../types';

const DB_NAME = 'QuizMasterDB';
const DB_VERSION = 1;
const QUIZ_STORE = 'quizzes';
const RESULTS_STORE = 'results';

class IndexedDBStorage {
  private db: IDBDatabase | null = null;

  // Initialize IndexedDB
  async init(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ IndexedDB failed to open:', request.error);
        reject(false);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialized successfully');
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create quizzes store if it doesn't exist
        if (!db.objectStoreNames.contains(QUIZ_STORE)) {
          const quizStore = db.createObjectStore(QUIZ_STORE, { keyPath: 'id' });
          quizStore.createIndex('title', 'title', { unique: false });
          quizStore.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('✅ Created quizzes object store');
        }

        // Create results store if it doesn't exist
        if (!db.objectStoreNames.contains(RESULTS_STORE)) {
          const resultsStore = db.createObjectStore(RESULTS_STORE, { keyPath: 'sessionId' });
          resultsStore.createIndex('completedAt', 'completedAt', { unique: false });
          console.log('✅ Created results object store');
        }
      };
    });
  }

  // Save all quizzes (replaces existing)
  async saveQuizzes(quizzes: SavedQuiz[]): Promise<boolean> {
    if (!this.db) await this.init();
    
    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([QUIZ_STORE], 'readwrite');
        const store = transaction.objectStore(QUIZ_STORE);

        // Clear existing quizzes
        store.clear();

        // Add new quizzes
        quizzes.forEach(quiz => {
          store.put(quiz);
        });

        transaction.oncomplete = () => {
          console.log(`✅ Saved ${quizzes.length} quizzes to IndexedDB`);
          resolve(true);
        };

        transaction.onerror = () => {
          console.error('❌ Error saving quizzes to IndexedDB:', transaction.error);
          resolve(false);
        };
      } catch (error) {
        console.error('❌ IndexedDB save error:', error);
        resolve(false);
      }
    });
  }

  // Get all quizzes
  async getQuizzes(): Promise<SavedQuiz[]> {
    if (!this.db) await this.init();

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([QUIZ_STORE], 'readonly');
        const store = transaction.objectStore(QUIZ_STORE);
        const request = store.getAll();

        request.onsuccess = () => {
          const quizzes = request.result as SavedQuiz[];
          console.log(`✅ Retrieved ${quizzes.length} quizzes from IndexedDB`);
          resolve(quizzes);
        };

        request.onerror = () => {
          console.error('❌ Error getting quizzes from IndexedDB:', request.error);
          resolve([]);
        };
      } catch (error) {
        console.error('❌ IndexedDB get error:', error);
        resolve([]);
      }
    });
  }

  // Get single quiz by ID
  async getQuiz(id: string): Promise<SavedQuiz | null> {
    if (!this.db) await this.init();

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([QUIZ_STORE], 'readonly');
        const store = transaction.objectStore(QUIZ_STORE);
        const request = store.get(id);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          console.error('❌ Error getting quiz from IndexedDB:', request.error);
          resolve(null);
        };
      } catch (error) {
        console.error('❌ IndexedDB get quiz error:', error);
        resolve(null);
      }
    });
  }

  // Save quiz results
  async saveResult(result: QuizResult): Promise<boolean> {
    if (!this.db) await this.init();

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([RESULTS_STORE], 'readwrite');
        const store = transaction.objectStore(RESULTS_STORE);
        store.put(result);

        transaction.oncomplete = () => {
          console.log('✅ Saved result to IndexedDB');
          resolve(true);
        };

        transaction.onerror = () => {
          console.error('❌ Error saving result to IndexedDB:', transaction.error);
          resolve(false);
        };
      } catch (error) {
        console.error('❌ IndexedDB save result error:', error);
        resolve(false);
      }
    });
  }

  // Get all results
  async getResults(): Promise<QuizResult[]> {
    if (!this.db) await this.init();

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([RESULTS_STORE], 'readonly');
        const store = transaction.objectStore(RESULTS_STORE);
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(request.result as QuizResult[]);
        };

        request.onerror = () => {
          console.error('❌ Error getting results from IndexedDB:', request.error);
          resolve([]);
        };
      } catch (error) {
        console.error('❌ IndexedDB get results error:', error);
        resolve([]);
      }
    });
  }

  // Clear all data
  async clear(): Promise<boolean> {
    if (!this.db) await this.init();

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([QUIZ_STORE, RESULTS_STORE], 'readwrite');
        transaction.objectStore(QUIZ_STORE).clear();
        transaction.objectStore(RESULTS_STORE).clear();

        transaction.oncomplete = () => {
          console.log('✅ Cleared all IndexedDB data');
          resolve(true);
        };

        transaction.onerror = () => {
          console.error('❌ Error clearing IndexedDB:', transaction.error);
          resolve(false);
        };
      } catch (error) {
        console.error('❌ IndexedDB clear error:', error);
        resolve(false);
      }
    });
  }

  // Check storage usage
  async getStorageEstimate(): Promise<{ usage: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    }
    return { usage: 0, quota: 0 };
  }
}

export const indexedDBStorage = new IndexedDBStorage();
