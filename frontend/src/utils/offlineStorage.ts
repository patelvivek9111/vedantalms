/**
 * IndexedDB wrapper for offline storage of grading data
 */

const DB_NAME = 'LMS_GradingDB';
const DB_VERSION = 1;
const STORE_NAMES = {
  GRADES: 'grades',
  FEEDBACK: 'feedback',
  SYNC_QUEUE: 'syncQueue'
};

interface GradeData {
  submissionId: string;
  assignmentId: string;
  questionGrades: Record<number, number | string>;
  timestamp: number;
  synced: boolean;
}

interface FeedbackData {
  submissionId: string;
  assignmentId: string;
  feedback: string;
  timestamp: number;
  synced: boolean;
}

interface SyncQueueItem {
  id: string;
  type: 'grade' | 'feedback';
  submissionId: string;
  assignmentId: string;
  data: any;
  timestamp: number;
  retries: number;
}

class OfflineStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains(STORE_NAMES.GRADES)) {
          const gradeStore = db.createObjectStore(STORE_NAMES.GRADES, { keyPath: 'submissionId' });
          gradeStore.createIndex('assignmentId', 'assignmentId', { unique: false });
          gradeStore.createIndex('synced', 'synced', { unique: false });
          gradeStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_NAMES.FEEDBACK)) {
          const feedbackStore = db.createObjectStore(STORE_NAMES.FEEDBACK, { keyPath: 'submissionId' });
          feedbackStore.createIndex('assignmentId', 'assignmentId', { unique: false });
          feedbackStore.createIndex('synced', 'synced', { unique: false });
          feedbackStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_NAMES.SYNC_QUEUE)) {
          const queueStore = db.createObjectStore(STORE_NAMES.SYNC_QUEUE, { keyPath: 'id' });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
          queueStore.createIndex('type', 'type', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  // Save grade data
  async saveGrade(submissionId: string, assignmentId: string, questionGrades: Record<number, number | string>): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAMES.GRADES], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.GRADES);

      const data: GradeData = {
        submissionId,
        assignmentId,
        questionGrades,
        timestamp: Date.now(),
        synced: false
      };

      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get grade data
  async getGrade(submissionId: string): Promise<GradeData | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAMES.GRADES], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.GRADES);
      const request = store.get(submissionId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Save feedback data
  async saveFeedback(submissionId: string, assignmentId: string, feedback: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAMES.FEEDBACK], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.FEEDBACK);

      const data: FeedbackData = {
        submissionId,
        assignmentId,
        feedback,
        timestamp: Date.now(),
        synced: false
      };

      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get feedback data
  async getFeedback(submissionId: string): Promise<FeedbackData | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAMES.FEEDBACK], 'readonly');
      const store = transaction.objectStore(STORE_NAMES.FEEDBACK);
      const request = store.get(submissionId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all unsynced items for an assignment
  async getUnsyncedItems(assignmentId: string): Promise<{ grades: GradeData[]; feedback: FeedbackData[] }> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAMES.GRADES, STORE_NAMES.FEEDBACK], 'readonly');
      const gradeStore = transaction.objectStore(STORE_NAMES.GRADES);
      const feedbackStore = transaction.objectStore(STORE_NAMES.FEEDBACK);

      const grades: GradeData[] = [];
      const feedback: FeedbackData[] = [];

      let completed = 0;
      const checkComplete = () => {
        completed++;
        if (completed === 2) {
          resolve({ grades, feedback });
        }
      };

      // Get all grades for this assignment and filter unsynced
      const assignmentGradeIndex = gradeStore.index('assignmentId');
      const gradeRequest = assignmentGradeIndex.openCursor(IDBKeyRange.only(assignmentId));
      gradeRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const data = cursor.value as GradeData;
          if (!data.synced) {
            grades.push(data);
          }
          cursor.continue();
        } else {
          checkComplete();
        }
      };
      gradeRequest.onerror = () => reject(gradeRequest.error);

      // Get all feedback for this assignment and filter unsynced
      const assignmentFeedbackIndex = feedbackStore.index('assignmentId');
      const feedbackRequest = assignmentFeedbackIndex.openCursor(IDBKeyRange.only(assignmentId));
      feedbackRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const data = cursor.value as FeedbackData;
          if (!data.synced) {
            feedback.push(data);
          }
          cursor.continue();
        } else {
          checkComplete();
        }
      };
      feedbackRequest.onerror = () => reject(feedbackRequest.error);
    });
  }

  // Mark grade as synced
  async markGradeSynced(submissionId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAMES.GRADES], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.GRADES);
      const getRequest = store.get(submissionId);

      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data.synced = true;
          const putRequest = store.put(data);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Mark feedback as synced
  async markFeedbackSynced(submissionId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAMES.FEEDBACK], 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.FEEDBACK);
      const getRequest = store.get(submissionId);

      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data.synced = true;
          const putRequest = store.put(data);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Clear all data for an assignment (cleanup)
  async clearAssignmentData(assignmentId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAMES.GRADES, STORE_NAMES.FEEDBACK], 'readwrite');
      const gradeStore = transaction.objectStore(STORE_NAMES.GRADES);
      const feedbackStore = transaction.objectStore(STORE_NAMES.FEEDBACK);

      let completed = 0;
      const checkComplete = () => {
        completed++;
        if (completed === 2) resolve();
      };

      // Clear grades
      const gradeIndex = gradeStore.index('assignmentId');
      const gradeRequest = gradeIndex.openCursor(IDBKeyRange.only(assignmentId));
      gradeRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          checkComplete();
        }
      };
      gradeRequest.onerror = () => reject(gradeRequest.error);

      // Clear feedback
      const feedbackIndex = feedbackStore.index('assignmentId');
      const feedbackRequest = feedbackIndex.openCursor(IDBKeyRange.only(assignmentId));
      feedbackRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          checkComplete();
        }
      };
      feedbackRequest.onerror = () => reject(feedbackRequest.error);
    });
  }

  // Check if IndexedDB is supported
  static isSupported(): boolean {
    return 'indexedDB' in window;
  }
}

export const offlineStorage = new OfflineStorage();
export type { GradeData, FeedbackData, SyncQueueItem };

