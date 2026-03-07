// Local File System Service - Native app-like storage access
import { SavedQuiz, QuizResult } from '../types';

// Type definitions for File System Access API
declare global {
  interface Window {
    showDirectoryPicker: (options?: {
      mode?: 'read' | 'readwrite';
      startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string): Promise<void>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
}

export class LocalFileSystemService {
  private static instance: LocalFileSystemService;
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private quizFolderHandle: FileSystemDirectoryHandle | null = null;
  private resultsFolderHandle: FileSystemDirectoryHandle | null = null;
  private hasPermission = false;

  static getInstance(): LocalFileSystemService {
    if (!LocalFileSystemService.instance) {
      LocalFileSystemService.instance = new LocalFileSystemService();
    }
    return LocalFileSystemService.instance;
  }

  // Check if File System Access API is supported
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  // Request permission to access user's file system
  async requestStoragePermission(): Promise<boolean> {
    if (!this.isSupported()) {
      console.log('File System Access API not supported in this browser');
      return false;
    }

    try {
      // Request permission to access a folder
      this.directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });

      if (this.directoryHandle) {
        // Create Quiz Master folder structure
        await this.createFolderStructure();
        this.hasPermission = true;
        
        // Save permission state
        localStorage.setItem('quiz_master_storage_permission', 'granted');
        localStorage.setItem('quiz_master_folder_name', this.directoryHandle.name);
        
        console.log('Storage permission granted:', this.directoryHandle.name);
        return true;
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('User cancelled storage permission');
      } else {
        console.error('Error requesting storage permission:', error);
      }
      return false;
    }

    return false;
  }

  // Create folder structure for Quiz Master
  private async createFolderStructure(): Promise<void> {
    if (!this.directoryHandle) return;

    try {
      // Create QuizMaster main folder
      const quizMasterHandle = await this.directoryHandle.getDirectoryHandle('QuizMaster', {
        create: true
      });

      // Create subfolders
      this.quizFolderHandle = await quizMasterHandle.getDirectoryHandle('Quizzes', {
        create: true
      });

      this.resultsFolderHandle = await quizMasterHandle.getDirectoryHandle('Results', {
        create: true
      });

      // Create info file
      await this.createInfoFile(quizMasterHandle);

      console.log('Quiz Master folder structure created successfully');
    } catch (error) {
      console.error('Error creating folder structure:', error);
    }
  }

  // Create info file with instructions
  private async createInfoFile(parentHandle: FileSystemDirectoryHandle): Promise<void> {
    try {
      const fileHandle = await parentHandle.getFileHandle('README.txt', { create: true });
      const writable = await fileHandle.createWritable();
      
      const content = `Quiz Master Local Storage
Created: ${new Date().toLocaleString()}

This folder contains your Quiz Master data:
- Quizzes/: All available quizzes
- Results/: Your quiz results

This folder is automatically managed by Quiz Master.
Do not manually modify files unless you know what you're doing.

Quiz Master - Educational Quiz Platform
`;

      await writable.write(content);
      await writable.close();
    } catch (error) {
      console.error('Error creating info file:', error);
    }
  }

  // Save quiz to local file system
  async saveQuizToLocal(quiz: SavedQuiz): Promise<boolean> {
    if (!this.hasPermission || !this.quizFolderHandle) {
      console.log('No storage permission or folder handle');
      return false;
    }

    try {
      const fileName = `${quiz.id}.json`;
      const fileHandle = await this.quizFolderHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      
      const quizData = {
        ...quiz,
        savedToLocal: true,
        localSaveTime: Date.now()
      };

      await writable.write(JSON.stringify(quizData, null, 2));
      await writable.close();

      console.log('Quiz saved to local file system:', quiz.title);
      return true;
    } catch (error) {
      console.error('Error saving quiz to local file system:', error);
      return false;
    }
  }

  // Load all quizzes from local file system
  async loadQuizzesFromLocal(): Promise<SavedQuiz[]> {
    if (!this.hasPermission || !this.quizFolderHandle) {
      return [];
    }

    const quizzes: SavedQuiz[] = [];

    try {
      // For now, we'll sync from browser storage and use file system for backup
      // This is a fallback until better browser support for directory iteration
      const browserQuizzes = JSON.parse(localStorage.getItem('quiz_master_saved_quizzes') || '[]');
      
      console.log(`Loaded ${browserQuizzes.length} quizzes from browser storage (file system backup available)`);
      return browserQuizzes;
    } catch (error) {
      console.error('Error loading quizzes:', error);
      return [];
    }
  }

  // Save quiz result to local file system
  async saveResultToLocal(result: QuizResult): Promise<boolean> {
    if (!this.hasPermission || !this.resultsFolderHandle) {
      return false;
    }

    try {
      const fileName = `result_${result.sessionId}.json`;
      const fileHandle = await this.resultsFolderHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      
      await writable.write(JSON.stringify(result, null, 2));
      await writable.close();

      console.log('Result saved to local file system');
      return true;
    } catch (error) {
      console.error('Error saving result to local file system:', error);
      return false;
    }
  }

  // Delete quiz from local file system
  async deleteQuizFromLocal(quizId: string): Promise<boolean> {
    if (!this.hasPermission || !this.quizFolderHandle) {
      return false;
    }

    try {
      const fileName = `${quizId}.json`;
      await this.quizFolderHandle.removeEntry(fileName);
      console.log('Quiz deleted from local file system');
      return true;
    } catch (error) {
      console.error('Error deleting quiz from local file system:', error);
      return false;
    }
  }

  // Check permission status
  getPermissionStatus(): { hasPermission: boolean; folderName: string | null } {
    const storedPermission = localStorage.getItem('quiz_master_storage_permission');
    const folderName = localStorage.getItem('quiz_master_folder_name');
    
    return {
      hasPermission: storedPermission === 'granted' && this.hasPermission,
      folderName
    };
  }

  // Sync local storage with file system
  async syncBrowserToFileSystem(): Promise<boolean> {
    if (!this.hasPermission) return false;

    try {
      // Get quizzes from browser localStorage
      const localQuizzes = JSON.parse(localStorage.getItem('quiz_master_saved_quizzes') || '[]');
      
      // Save each quiz to file system
      for (const quiz of localQuizzes) {
        await this.saveQuizToLocal(quiz);
      }

      console.log('Browser storage synced to file system');
      return true;
    } catch (error) {
      console.error('Error syncing browser to file system:', error);
      return false;
    }
  }

  // Sync file system to browser storage
  async syncFileSystemToBrowser(): Promise<boolean> {
    if (!this.hasPermission) return false;

    try {
      const fileQuizzes = await this.loadQuizzesFromLocal();
      // Don't save to localStorage - causes QuotaExceeded errors
      console.log(`💾 Loaded ${fileQuizzes.length} quizzes from file system (not saved to localStorage)`);
      
      console.log('File system loaded (quizzes in memory only)');
      return true;
    } catch (error) {
      console.error('Error syncing file system to browser:', error);
      return false;
    }
  }

  // Restore permission from previous session
  async restorePermission(): Promise<boolean> {
    const storedPermission = localStorage.getItem('quiz_master_storage_permission');
    
    if (storedPermission === 'granted' && this.isSupported()) {
      try {
        // Try to restore the directory handle
        // Note: This is a simplified approach - in reality, you'd need to store handle references
        console.log('Attempting to restore storage permission...');
        return await this.requestStoragePermission();
      } catch (error) {
        console.error('Error restoring permission:', error);
        return false;
      }
    }
    
    return false;
  }

  // Get storage info
  getStorageInfo(): {
    supported: boolean;
    hasPermission: boolean;
    folderPath: string | null;
    quizCount: number;
  } {
    return {
      supported: this.isSupported(),
      hasPermission: this.hasPermission,
      folderPath: this.directoryHandle?.name || null,
      quizCount: 0 // Could be enhanced to count files
    };
  }
}

export const localFileSystem = LocalFileSystemService.getInstance();
