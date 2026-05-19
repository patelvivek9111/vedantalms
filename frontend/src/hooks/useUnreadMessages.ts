import { useState, useEffect } from 'react';
import { fetchConversations } from '../services/inboxService';
import { useAuth } from '../contexts/AuthContext';

export const useUnreadMessages = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth() as any;

  const fetchUnreadCount = async () => {
    try {
      setLoading(true);
      // Gmail-like inbox unread: received threads that are not archived/deleted.
      const conversations = await fetchConversations();
      const totalUnread = conversations.reduce((sum: number, conv: any) => {
        const me = (conv.participants || []).find((p: any) => p?._id?.toString?.() === user?._id?.toString?.()) || null;
        const folder = me?.folder || conv.folder || 'inbox';
        const countsInInbox = conv.hasReceivedMessage === true && folder !== 'archived' && folder !== 'deleted';
        if (!countsInInbox) return sum;
        return sum + (conv.unreadCount || 0);
      }, 0);
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
  }, [user?._id]);

  return { unreadCount, loading, refreshUnreadCount: fetchUnreadCount };
};
