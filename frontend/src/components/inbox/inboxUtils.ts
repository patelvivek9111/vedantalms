import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { stripHtmlToText } from '../../utils/htmlUtils';

export function capitalizeFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function parseThreadSubject(subject: string) {
  const parts = subject.split(' — ');
  if (parts.length < 2) {
    return { context: null as string | null, title: subject };
  }
  return { context: parts[0], title: parts.slice(1).join(' — ') };
}

export function getOtherParticipantNames(conversation: any, currentUserId: string) {
  const others = (conversation?.participants || []).filter(
    (p: any) => p._id?.toString() !== currentUserId?.toString()
  );
  return others
    .map((p: any) =>
      p.firstName && p.lastName
        ? `${p.firstName} ${p.lastName}`.trim()
        : p.firstName || p.lastName || p.email || 'Unknown'
    )
    .join(', ');
}

export const getInitials = (user: any) => {
  if (!user) return '?';
  if (user.firstName && user.lastName) return (user.firstName[0] + user.lastName[0]).toUpperCase();
  if (user.firstName) return user.firstName[0].toUpperCase();
  if (user.lastName) return user.lastName[0].toUpperCase();
  if (user.email) return user.email[0].toUpperCase();
  return '?';
};

export const getAvatarColor = (id: string) => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-pink-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-gray-500',
  ];
  let hash = 0;
  for (let i = 0; i < (id || '').length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
};

export function groupConversationsByDate(conversations: any[]) {
  const groups: { [date: string]: any[] } = {};
  conversations.forEach((conv) => {
    const date = conv.lastMessage
      ? format(new Date(conv.lastMessage.createdAt), 'yyyy-MM-dd')
      : 'No Date';
    if (!groups[date]) groups[date] = [];
    groups[date].push(conv);
  });
  return groups;
}

export function formatDateHeader(dateStr: string) {
  const date = parseISO(dateStr + 'T00:00:00');
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
}

export function formatMessagePreview(body: string | undefined | null, maxLength = 80): string {
  const text = stripHtmlToText(body);
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}…`;
}

export const FOLDER_OPTIONS = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'sent', label: 'Sent' },
  { value: 'archived', label: 'Archived' },
  { value: 'favorite', label: 'Favorite' },
  { value: 'deleted', label: 'Deleted' },
] as const;
