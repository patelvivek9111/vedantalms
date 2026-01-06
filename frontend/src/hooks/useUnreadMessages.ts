import { useState, useEffect } from 'react';
import { fetchConversations } from '../services/inboxService';

export const useUnreadMessages = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUnreadCount = async () => {
    try {
      setLoading(true);
      const conversations = await fetchConversations();
      const totalUnread = conversations.reduce((sum: number, conv: any) => sum + (conv.unreadCount || 0), 0);
      setUnreadCount(totalUnread);
    } catch (error) {
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    
    // Refresh every 30 seconds to keep count updated
    const interval = setInterval(fetchUnreadCount, 30000);
    
    // Listen for inbox message read events
    const handleInboxMessageRead = () => {
      fetchUnreadCount();
    };
    
    window.addEventListener('inboxMessageRead', handleInboxMessageRead);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('inboxMessageRead', handleInboxMessageRead);
    };
  }, []);

  return { unreadCount, loading, refreshUnreadCount: fetchUnreadCount };
};
