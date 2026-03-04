import { useState, useEffect, useCallback, useRef } from 'react';

interface UseDraftManagerOptions {
  formId: string;
  autoSaveDelay?: number; // milliseconds
  storageKey?: string;
  enabled?: boolean; // Enable/disable draft saving
}

export const useDraftManager = <T extends Record<string, any>>(
  options: UseDraftManagerOptions
) => {
  const { formId, autoSaveDelay = 1000, storageKey = 'formDrafts' } = options;
  const [draft, setDraft] = useState<T | null>(null);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load draft on mount
  useEffect(() => {
    try {
      const savedDrafts = localStorage.getItem(storageKey);
      if (savedDrafts) {
        const drafts = JSON.parse(savedDrafts);
        const savedDraft = drafts[formId];
        if (savedDraft) {
          setDraft(savedDraft.data);
          setLastSaved(new Date(savedDraft.timestamp));
        }
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  }, [formId, storageKey]);

  // Save draft to localStorage
  const saveDraft = useCallback((data: T) => {
    try {
      const savedDrafts = localStorage.getItem(storageKey);
      const drafts = savedDrafts ? JSON.parse(savedDrafts) : {};
      
      drafts[formId] = {
        data,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem(storageKey, JSON.stringify(drafts));
      setDraft(data);
      setIsDraftSaved(true);
      setLastSaved(new Date());
      
      // Clear saved indicator after 3 seconds
      setTimeout(() => setIsDraftSaved(false), 3000);
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }, [formId, storageKey]);

  // Auto-save with debounce
  const autoSave = useCallback((data: T) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft(data);
    }, autoSaveDelay);
  }, [saveDraft, autoSaveDelay]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Clear draft
  const clearDraft = useCallback(() => {
    try {
      const savedDrafts = localStorage.getItem(storageKey);
      if (savedDrafts) {
        const drafts = JSON.parse(savedDrafts);
        delete drafts[formId];
        localStorage.setItem(storageKey, JSON.stringify(drafts));
      }
      setDraft(null);
      setLastSaved(null);
      setIsDraftSaved(false);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  }, [formId, storageKey]);

  // Restore draft
  const restoreDraft = useCallback((): T | null => {
    return draft;
  }, [draft]);

  return {
    draft,
    isDraftSaved,
    lastSaved,
    saveDraft,
    autoSave,
    clearDraft,
    restoreDraft
  };
};

