import { SavedQuiz } from '../types';

/**
 * Quiz Backup Service
 * Provides import/export functionality for quizzes
 * Ensures quizzes are never lost even if Firebase fails
 */
export class QuizBackupService {
  
  /**
   * Export quiz as downloadable JSON file
   */
  static exportQuiz(quiz: SavedQuiz): void {
    try {
      // Create JSON blob
      const jsonString = JSON.stringify(quiz, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const safeTitle = quiz.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      link.download = `quiz_${safeTitle}_${timestamp}.json`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('✅ Quiz exported successfully:', quiz.title);
    } catch (error) {
      console.error('❌ Error exporting quiz:', error);
      alert('Failed to export quiz. Please try again.');
    }
  }

  /**
   * Export multiple quizzes as a single backup file
   */
  static exportAllQuizzes(quizzes: SavedQuiz[]): void {
    try {
      const backupData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        quizCount: quizzes.length,
        quizzes: quizzes
      };
      
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `quiz_master_backup_${timestamp}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log(`✅ Exported ${quizzes.length} quizzes successfully`);
      alert(`✅ Exported ${quizzes.length} quizzes successfully!\n\nFile saved to your Downloads folder.`);
    } catch (error) {
      console.error('❌ Error exporting quizzes:', error);
      alert('Failed to export quizzes. Please try again.');
    }
  }

  /**
   * Import quiz from JSON file
   */
  static async importQuiz(file: File): Promise<SavedQuiz | null> {
    try {
      // Read file
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate quiz data
      if (!this.isValidQuiz(data)) {
        alert('❌ Invalid quiz file format!\n\nPlease select a valid quiz JSON file.');
        return null;
      }
      
      // Generate new ID to avoid conflicts
      const importedQuiz: SavedQuiz = {
        ...data,
        id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
        title: `${data.title} (Imported)`
      };
      
      console.log('✅ Quiz imported successfully:', importedQuiz.title);
      return importedQuiz;
    } catch (error) {
      console.error('❌ Error importing quiz:', error);
      alert('❌ Failed to import quiz!\n\nError: ' + (error as Error).message);
      return null;
    }
  }

  /**
   * Import multiple quizzes from backup file
   */
  static async importBackup(file: File): Promise<SavedQuiz[]> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Check if it's a backup file
      const quizzes = data.quizzes || [data];
      
      // Validate and import each quiz
      const importedQuizzes: SavedQuiz[] = [];
      
      for (const quizData of quizzes) {
        if (this.isValidQuiz(quizData)) {
          const importedQuiz: SavedQuiz = {
            ...quizData,
            id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: Date.now()
          };
          importedQuizzes.push(importedQuiz);
        }
      }
      
      if (importedQuizzes.length === 0) {
        alert('❌ No valid quizzes found in the file!');
        return [];
      }
      
      console.log(`✅ Imported ${importedQuizzes.length} quizzes successfully`);
      alert(`✅ Successfully imported ${importedQuizzes.length} quiz(es)!`);
      return importedQuizzes;
    } catch (error) {
      console.error('❌ Error importing backup:', error);
      alert('❌ Failed to import backup!\n\nError: ' + (error as Error).message);
      return [];
    }
  }

  /**
   * Validate quiz data structure
   */
  private static isValidQuiz(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.title === 'string' &&
      Array.isArray(data.questions) &&
      data.questions.length > 0
    );
  }

  /**
   * Create automatic local backup
   */
  static createLocalBackup(quiz: SavedQuiz): void {
    try {
      const backupKey = `quiz_backup_${quiz.id}`;
      const backupData = {
        quiz,
        timestamp: Date.now(),
        version: '1.0'
      };
      
      localStorage.setItem(backupKey, JSON.stringify(backupData));
      console.log('💾 Local backup created:', quiz.title);
    } catch (error) {
      console.error('⚠️ Failed to create local backup:', error);
      // Don't show error to user - backup is silent
    }
  }

  /**
   * Get all local backups
   */
  static getAllLocalBackups(): SavedQuiz[] {
    const backups: SavedQuiz[] = [];
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('quiz_backup_')) {
          const data = localStorage.getItem(key);
          if (data) {
            const backup = JSON.parse(data);
            backups.push(backup.quiz);
          }
        }
      }
    } catch (error) {
      console.error('⚠️ Error reading local backups:', error);
    }
    
    return backups;
  }

  /**
   * Calculate file size for quiz
   */
  static getQuizFileSize(quiz: SavedQuiz): string {
    const jsonString = JSON.stringify(quiz);
    const bytes = new Blob([jsonString]).size;
    
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
}

export default QuizBackupService;
