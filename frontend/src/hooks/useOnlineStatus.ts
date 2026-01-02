import { useState, useEffect } from 'react';
import { getUserPreferences } from '../services/api';

// Simple online status tracking
// In a real implementation, this would use WebSockets to track real-time presence
const onlineUsers = new Set<string>();
const subscribers = new Set<(users: Set<string>) => void>();
const currentUserShowOnlineStatus = new Map<string, boolean>(); // Current user's preference

// Simulate online users (for demo purposes)
// In production, this would be managed by a WebSocket connection
export const useOnlineStatus = (userId?: string) => {
  const [onlineUsersSet, setOnlineUsersSet] = useState<Set<string>>(new Set());
  const [currentUserPref, setCurrentUserPref] = useState<boolean>(true);

  useEffect(() => {
    // Load current user's preference for showOnlineStatus
    const loadUserPreferences = async () => {
      try {
        const res = await getUserPreferences();
        const showStatus = res.data?.preferences?.showOnlineStatus !== undefined 
          ? res.data.preferences.showOnlineStatus 
          : true; // Default to true
        if (userId) {
          currentUserShowOnlineStatus.set(userId, showStatus);
          setCurrentUserPref(showStatus);
        }
      } catch (err) {
        // Default to true if preference not found
        if (userId) {
          currentUserShowOnlineStatus.set(userId, true);
          setCurrentUserPref(true);
        }
      }
    };

    if (userId) {
      loadUserPreferences();
    }
  }, [userId]);

  useEffect(() => {
    // Subscribe to online status updates
    const updateSubscribers = () => {
      subscribers.forEach(callback => callback(onlineUsers));
    };

    const handleUpdate = (users: Set<string>) => {
      setOnlineUsersSet(new Set(users));
    };

    subscribers.add(handleUpdate);
    updateSubscribers();

    // Mark current user as online (only if they want to show online status)
    if (userId && currentUserPref) {
      onlineUsers.add(userId);
      updateSubscribers();
    } else if (userId && !currentUserPref) {
      // Remove from online users if they don't want to show status
      onlineUsers.delete(userId);
      updateSubscribers();
    }

    // For demo: Mark some users as online (you can remove this in production)
    // In production, this would come from WebSocket events
    const interval = setInterval(() => {
      updateSubscribers();
    }, 30000); // Check every 30 seconds

    // Cleanup: mark user as offline when component unmounts
    return () => {
      clearInterval(interval);
      subscribers.delete(handleUpdate);
      if (userId) {
        setTimeout(() => {
          onlineUsers.delete(userId);
          updateSubscribers();
        }, 5000);
      }
    };
  }, [userId, currentUserPref]);

  const isUserOnline = (checkUserId: string) => {
    if (!checkUserId) return false;
    
    // For now, assume other users have showOnlineStatus enabled (default)
    // In production, this would check the user's preference from the backend
    // Check if user is actually in the online set
    if (onlineUsersSet.has(checkUserId)) return true;
    
    return false;
  };

  return { isUserOnline, onlineUsers: onlineUsersSet };
};

// Helper function to mark a user as online (can be called from socket events)
export const markUserOnline = (userId: string) => {
  onlineUsers.add(userId);
  subscribers.forEach(callback => callback(onlineUsers));
};

// Helper function to mark a user as offline
export const markUserOffline = (userId: string) => {
  onlineUsers.delete(userId);
  subscribers.forEach(callback => callback(onlineUsers));
};

