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
      <div className="text-center py-16">
        <div className="flex flex-col items-center">
          <Megaphone className="h-16 w-16 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No announcements yet</h3>
          <p className="text-sm text-gray-500">Check back later for group announcements.</p>
        </div>
      </div>
    );
  }
  return (
    <ul className="space-y-4">
      {announcements.map(a => (
        <li
          key={a._id}
          className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 hover:shadow-md transition cursor-pointer border border-gray-100 dark:border-gray-700"
          onClick={() => onSelect?.(a)}
        >
          <div className="flex justify-between items-start mb-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{a.title}</h3>
            <span className="text-xs text-gray-400 dark:text-gray-300 mt-1">
              {(() => {
                const d = new Date(a.createdAt);
                const date = d.toLocaleDateString();
                let time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                return `${date} at ${time}`;
              })()}
            </span>
          </div>
          <div className="text-sm text-gray-800 dark:text-gray-200 mb-1 prose max-w-none">
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