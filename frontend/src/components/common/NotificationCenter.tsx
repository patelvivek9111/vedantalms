import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Check, CheckCheck, Trash2, MessageSquare, Award, Megaphone, FileText, Calendar, Users, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationListQuery } from '../../hooks/notifications/useNotificationListQuery';
import { useNotificationUnreadQuery } from '../../hooks/notifications/useNotificationUnreadQuery';
import {
  useNotificationMutations,
  type NotificationItem,
} from '../../hooks/notifications/useNotificationMutations';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const normalizeNotificationMessage = (message: string) => {
  if (!message) return '';

  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(message, 'text/html');
    const text = doc.body.textContent || '';
    return text.replace(/\s+/g, ' ').trim();
  }

  return message
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth() as { user?: { _id?: string } };
  const userId = user?._id;
  const navigate = useNavigate();
  const notificationRef = useRef<HTMLDivElement>(null);

  const { data: listData, isLoading: listLoading } = useNotificationListQuery(userId, isOpen);
  const { data: badgeUnread = 0 } = useNotificationUnreadQuery(userId);
  const { markRead, markAllRead, remove } = useNotificationMutations(userId);

  const notifications: NotificationItem[] = listData?.items ?? [];
  const unreadCount = badgeUnread;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isOpen, onClose]);

  const handleMarkAsRead = (id: string) => {
    markRead.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllRead.mutate();
  };

  const handleDelete = (id: string) => {
    remove.mutate(id);
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.read) {
      handleMarkAsRead(notification._id);
    }
    if (notification.link) {
      navigate(notification.link);
      onClose();
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="h-3.5 w-3.5 text-blue-500" />;
      case 'grade':
      case 'assignment_graded':
        return <Award className="h-3.5 w-3.5 text-green-500" />;
      case 'announcement':
        return <Megaphone className="h-3.5 w-3.5 text-orange-500" />;
      case 'assignment_due':
        return <Calendar className="h-3.5 w-3.5 text-red-500" />;
      case 'enrollment':
        return <Users className="h-3.5 w-3.5 text-purple-500" />;
      case 'discussion':
        return <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />;
      case 'submission':
        return <FileText className="h-3.5 w-3.5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-3.5 w-3.5 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-500';
      case 'high':
        return 'border-l-orange-500';
      case 'medium':
        return 'border-l-blue-500';
      default:
        return 'border-l-gray-300 dark:border-l-gray-600';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 lg:pt-16 pt-20 pr-2 sm:pr-4 pointer-events-none">
      <div
        ref={notificationRef}
        className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 pointer-events-auto max-h-[calc(100vh-4rem)] flex flex-col"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-gray-700 dark:text-gray-300" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Notifications</h2>
            {unreadCount > 0 && (
              <span
                className="px-1.5 py-0.5 bg-blue-500 text-white text-xs font-medium rounded-full"
                aria-label={`${unreadCount} unread notifications`}
              >
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={markAllRead.isPending}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                title="Mark all as read"
                aria-label="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {listLoading ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`px-2.5 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer border-l-2 ${getPriorityColor(notification.priority)} ${
                    !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs font-medium truncate ${notification.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-gray-100'}`}
                          >
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                            {normalizeNotificationMessage(notification.message)}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-0.5">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {!notification.read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notification._id);
                              }}
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-gray-400 transition-colors hover:text-blue-500 dark:hover:text-blue-400"
                              title="Mark as read"
                              aria-label="Mark as read"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(notification._id);
                            }}
                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-gray-400 transition-colors hover:text-red-500 dark:hover:text-red-400"
                            title="Delete"
                            aria-label="Delete notification"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
