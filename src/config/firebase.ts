import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, serverTimestamp } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';

// Firebase configuration for Quiz Master app - Real-time System
// ✅ REAL Firebase credentials - Connected to quiz-web-app-109af project
const firebaseConfig = {
  apiKey: "AIzaSyBRp2rlr4WoPvq-Ut6Vs4cJAoU56qM5Y40",
  authDomain: "quiz-web-app-109af.firebaseapp.com",
  projectId: "quiz-web-app-109af",
  storageBucket: "quiz-web-app-109af.firebasestorage.app",
  messagingSenderId: "482157581997",
  appId: "1:482157581997:web:03ae71b62000dfa0ccd824"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const serverTime = serverTimestamp;

// Initialize Firebase Cloud Messaging (with support check)
let messaging: any = null;
isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app);
  }
}).catch(err => {
  console.log('FCM not supported:', err);
});

export { messaging };

// Firebase Collections
export const COLLECTIONS = {
  USERS: 'users',
  QUIZZES: 'quizzes', 
  ATTEMPTS: 'attempts',
  NOTIFICATIONS: 'notifications'
};

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  STUDENT: 'student'
};

// Enhanced Cloud Storage using Browser Storage API + Cross-tab communication
export class CloudStorage {
  private static readonly SHARED_STORAGE_KEY = 'quiz_master_shared_data';
  private static readonly SYNC_TIMESTAMP_KEY = 'quiz_master_sync_timestamp';
  private static readonly ADMIN_SYNC_KEY = 'quiz_master_admin_updates';
  
  // Save data to shared storage (simulates cloud)
  static async setItem(key: string, value: any): Promise<void> {
    return new Promise((resolve) => {
      try {
        const sharedData = this.getSharedData();
        sharedData[key] = {
          value,
          timestamp: Date.now(),
          syncId: Math.random().toString(36).substr(2, 9)
        };
        
        localStorage.setItem(this.SHARED_STORAGE_KEY, JSON.stringify(sharedData));
        localStorage.setItem(this.SYNC_TIMESTAMP_KEY, Date.now().toString());
        
        // Trigger storage event for cross-tab sync
        window.dispatchEvent(new StorageEvent('storage', {
          key: this.SHARED_STORAGE_KEY,
          newValue: JSON.stringify(sharedData),
          storageArea: localStorage
        }));
        
        console.log('✅ Data saved to shared storage:', key);
        resolve();
      } catch (error) {
        console.error('❌ Error saving to shared storage:', error);
        resolve();
      }
    });
  }
  
  static async getItem(key: string): Promise<any> {
    return new Promise((resolve) => {
      try {
        const sharedData = this.getSharedData();
        const item = sharedData[key];
        resolve(item ? item.value : null);
      } catch (error) {
        console.error('❌ Error reading from shared storage:', error);
        resolve(null);
      }
    });
  }
  
  static async getAllQuizzes(): Promise<any[]> {
    return new Promise((resolve) => {
      try {
        const sharedData = this.getSharedData();
        const quizzes = [];
        
        for (const [key, data] of Object.entries(sharedData)) {
          if (key.startsWith('quiz_') && data && typeof data === 'object' && 'value' in data) {
            quizzes.push((data as any).value);
          }
        }
        
        // Sort by creation date (newest first)
        quizzes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        console.log('📥 Retrieved quizzes from shared storage:', quizzes.length);
        resolve(quizzes);
      } catch (error) {
        console.error('❌ Error getting all quizzes:', error);
        resolve([]);
      }
    });
  }
  
  static async deleteItem(key: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        const sharedData = this.getSharedData();
        delete sharedData[key];
        
        localStorage.setItem(this.SHARED_STORAGE_KEY, JSON.stringify(sharedData));
        localStorage.setItem(this.SYNC_TIMESTAMP_KEY, Date.now().toString());
        
        // Trigger storage event
        window.dispatchEvent(new StorageEvent('storage', {
          key: this.SHARED_STORAGE_KEY,
          newValue: JSON.stringify(sharedData),
          storageArea: localStorage
        }));
        
        console.log('🗑️ Deleted from shared storage:', key);
        resolve();
      } catch (error) {
        console.error('❌ Error deleting from shared storage:', error);
        resolve();
      }
    });
  }
  
  private static getSharedData(): Record<string, any> {
    try {
      const data = localStorage.getItem(this.SHARED_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('❌ Error parsing shared data:', error);
      return {};
    }
  }
  
  static getLastSyncTime(): number {
    try {
      const timestamp = localStorage.getItem(this.SYNC_TIMESTAMP_KEY);
      return timestamp ? parseInt(timestamp) : 0;
    } catch (error) {
      return 0;
    }
  }
  
  // Mark that admin has made updates
  static markAdminUpdate(): void {
    const updateId = Date.now().toString();
    localStorage.setItem(this.ADMIN_SYNC_KEY, updateId);
    
    // Broadcast to all tabs
    const event = new CustomEvent('adminQuizUpdate', {
      detail: { updateId, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
  }
  
  // Check if there are admin updates
  static getLastAdminUpdate(): number {
    try {
      const updateId = localStorage.getItem(this.ADMIN_SYNC_KEY);
      return updateId ? parseInt(updateId) : 0;
    } catch (error) {
      return 0;
    }
  }
  
  // Setup cross-tab communication listener
  static setupCrossTabSync(callback: () => void): () => void {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === this.SHARED_STORAGE_KEY) {
        console.log('🔄 Cross-tab sync detected');
        callback();
      }
    };
    
    const handleAdminUpdate = (e: CustomEvent) => {
      console.log('👨‍💼 Admin update detected:', e.detail);
      callback();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('adminQuizUpdate', handleAdminUpdate as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('adminQuizUpdate', handleAdminUpdate as EventListener);
    };
  }
  
  // Check if there are updates since last check
  static hasUpdates(lastCheck: number): boolean {
    return this.getLastSyncTime() > lastCheck;
  }
}

export default app;
