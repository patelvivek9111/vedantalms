import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Megaphone } from 'lucide-react';

export interface Announcement {
  _id: string;
  title: string;
  body: string;
  createdAt: string;
  author: { firstName: string; lastName: string };
  options?: {
    delayPosting?: boolean;
    allowComments?: boolean;
    requirePostBeforeSeeingReplies?: boolean;
    enablePodcastFeed?: boolean;
    allowLiking?: boolean;
  };
  postTo?: string;
  delayedUntil?: string;
}

interface AnnouncementListProps {
  announcements: Announcement[];
  onSelect?: (announcement: Announcement) => void;
}

const AnnouncementList: React.FC<AnnouncementListProps> = ({ announcements, onSelect }) => {
  const { user } = useAuth();
  if (!announcements.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/70 py-14 text-center dark:border-gray-600 dark:bg-gray-800/50">
        <div className="flex flex-col items-center">
          <Megaphone className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">No announcements yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Check back later for course announcements.</p>
        </div>
      </div>
    );
  }
  return (
    <ul className="space-y-3 sm:space-y-4">
      {announcements.map(a => (
        <li
          key={a._id}
          className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
          onClick={() => onSelect?.(a)}
        >
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight break-words">{a.title}</h3>
            <span className="text-xs text-gray-400 dark:text-gray-300 whitespace-nowrap">
              {(() => {
                const d = new Date(a.createdAt);
                const date = d.toLocaleDateString();
                let time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                return `${date} at ${time}`;
              })()}
            </span>
          </div>
          <div className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 mb-1 prose max-w-none">
            {(() => {
              const plain = a.body.replace(/<[^>]+>/g, '');
              const firstLine = plain.split(/\r?\n|\r|<br\s*\/?>/i)[0];
              return firstLine.length > 120 ? firstLine.slice(0, 120) + '…' : firstLine;
            })()}
          </div>
        </li>
      ))}
    </ul>
  );
};

export default AnnouncementList; 