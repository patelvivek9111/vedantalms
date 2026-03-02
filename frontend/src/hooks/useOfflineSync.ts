import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineStorage, GradeData, FeedbackData } from '../utils/offlineStorage';
import api from '../services/api';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface UseOfflineSyncOptions {
  assignmentId: string;
  submissionId?: string;
  onSyncComplete?: () => void;
  onSyncError?: (error: Error) => void;
}

interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSynced: Date | null;
  error: string | null;
}

export const useOfflineSync = (options: UseOfflineSyncOptions) => {
  const { assignmentId, submissionId, onSyncComplete, onSyncError } = options;
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    pendingCount: 0,
    lastSynced: null,
    error: null
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync when coming back online
      if (assignmentId) {
        syncPendingChanges();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncState(prev => ({ ...prev, status: 'offline' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [assignmentId]);

  // Check for pending items on mount and when assignment changes
  useEffect(() => {
    if (assignmentId) {
      checkPendingItems();
    }
  }, [assignmentId]);

  // Check for pending sync items
  const checkPendingItems = useCallback(async () => {
    try {
      const { grades, feedback } = await offlineStorage.getUnsyncedItems(assignmentId);
      const pendingCount = grades.length + feedback.length;
      
      setSyncState(prev => ({
        ...prev,
        pendingCount,
        status: pendingCount > 0 && !isOnline ? 'offline' : prev.status
      }));

      // Auto-sync if online and there are pending items
      if (pendingCount > 0 && isOnline && !isSyncingRef.current) {
        syncPendingChanges();
      }
    } catch (error) {
      console.error('Error checking pending items:', error);
    }
  }, [assignmentId, isOnline]);

  // Sync pending changes to server
  const syncPendingChanges = useCallback(async () => {
    if (isSyncingRef.current || !isOnline) return;

    try {
      isSyncingRef.current = true;
      setSyncState(prev => ({ ...prev, status: 'syncing', error: null }));

      const { grades, feedback } = await offlineStorage.getUnsyncedItems(assignmentId);
      const totalPending = grades.length + feedback.length;

      if (totalPending === 0) {
        setSyncState(prev => ({ ...prev, status: 'synced', pendingCount: 0 }));
        isSyncingRef.current = false;
        return;
      }

      // Group by submission ID to combine grades and feedback
      const submissionMap = new Map<string, { grades?: GradeData; feedback?: FeedbackData }>();
      
      grades.forEach(gradeData => {
        if (!submissionMap.has(gradeData.submissionId)) {
          submissionMap.set(gradeData.submissionId, {});
        }
        submissionMap.get(gradeData.submissionId)!.grades = gradeData;
      });
      
      feedback.forEach(feedbackData => {
        if (!submissionMap.has(feedbackData.submissionId)) {
          submissionMap.set(feedbackData.submissionId, {});
        }
        submissionMap.get(feedbackData.submissionId)!.feedback = feedbackData;
      });

      // Sync each submission (combining grades and feedback if both exist)
      for (const [submissionId, data] of submissionMap.entries()) {
        try {
          const payload: any = {
            approveGrade: false
          };

          // Add question grades if available
          if (data.grades) {
            payload.questionGrades = data.grades.questionGrades;
          }

          // Add feedback if available
          if (data.feedback) {
            payload.feedback = data.feedback.feedback;
          }

          // Use the same endpoint as the actual save operation
          await api.put(`/submissions/${submissionId}`, payload);

          // Mark both as synced if they were synced
          if (data.grades) {
            await offlineStorage.markGradeSynced(submissionId);
          }
          if (data.feedback) {
            await offlineStorage.markFeedbackSynced(submissionId);
          }
        } catch (error: any) {
          console.error(`Failed to sync submission ${submissionId}:`, error);
          // Continue with other items even if one fails
        }
      }

      // Recheck pending items
      await checkPendingItems();

      setSyncState(prev => ({
        ...prev,
        status: 'synced',
        lastSynced: new Date(),
        error: null
      }));

      onSyncComplete?.();

      // Clear synced status after 3 seconds
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        setSyncState(prev => ({ ...prev, status: 'idle' }));
      }, 3000);
    } catch (error: any) {
      console.error('Error syncing pending changes:', error);
      setSyncState(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'Failed to sync changes'
      }));
      onSyncError?.(error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [assignmentId, isOnline, checkPendingItems, onSyncComplete, onSyncError]);

  // Save grade data (to IndexedDB)
  const saveGrade = useCallback(async (
    submissionId: string,
    questionGrades: Record<number, number | string>
  ) => {
    try {
      await offlineStorage.saveGrade(submissionId, assignmentId, questionGrades);
      
      // Update pending count
      await checkPendingItems();

      // Try to sync immediately if online
      if (isOnline) {
        syncPendingChanges();
      }
    } catch (error) {
      console.error('Error saving grade offline:', error);
      throw error;
    }
  }, [assignmentId, isOnline, checkPendingItems, syncPendingChanges]);

  // Save feedback data (to IndexedDB)
  const saveFeedback = useCallback(async (
    submissionId: string,
    feedback: string
  ) => {
    try {
      await offlineStorage.saveFeedback(submissionId, assignmentId, feedback);
      
      // Update pending count
      await checkPendingItems();

      // Try to sync immediately if online
      if (isOnline) {
        syncPendingChanges();
      }
    } catch (error) {
      console.error('Error saving feedback offline:', error);
      throw error;
    }
  }, [assignmentId, isOnline, checkPendingItems, syncPendingChanges]);

  // Load saved data for a submission
  const loadSavedData = useCallback(async (submissionId: string) => {
    try {
      const [gradeData, feedbackData] = await Promise.all([
        offlineStorage.getGrade(submissionId),
        offlineStorage.getFeedback(submissionId)
      ]);

      return {
        questionGrades: gradeData?.questionGrades || null,
        feedback: feedbackData?.feedback || null
      };
    } catch (error) {
      console.error('Error loading saved data:', error);
      return { questionGrades: null, feedback: null };
    }
  }, []);

  // Manual sync trigger
  const triggerSync = useCallback(() => {
    if (isOnline && !isSyncingRef.current) {
      syncPendingChanges();
    }
  }, [isOnline, syncPendingChanges]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    syncState,
    isOnline,
    saveGrade,
    saveFeedback,
    loadSavedData,
    triggerSync,
    checkPendingItems
  };
};

