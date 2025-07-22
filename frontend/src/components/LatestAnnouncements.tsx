import React, { useEffect, useState } from 'react';
import { getAnnouncements } from '../services/announcementService';
import { MessageSquare, Calendar, User, Clock, ExternalLink } from 'lucide-react';
import AnnouncementDetailModal from './AnnouncementDetailModal';

interface LatestAnnouncementsProps {
  courseId: string;
  numberOfAnnouncements: number;
}

interface Announcement {
  _id: string;
  title: string;
  body: string;
  createdAt: string;
  author: {
    firstName: string;
    lastName: string;
  };
  options?: {
    allowComments?: boolean;
    requirePostBeforeSeeingReplies?: boolean;
    allowLiking?: boolean;
  };
}

const LatestAnnouncements: React.FC<LatestAnnouncementsProps> = ({
  courseId,
  numberOfAnnouncements
}) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        setLoading(true);
        const data = await getAnnouncements(courseId);
        // Take only the latest announcements based on numberOfAnnouncements
        const latestAnnouncements = data.slice(0, numberOfAnnouncements);
        setAnnouncements(latestAnnouncements);
      } catch (err) {
        setError('Failed to load announcements');
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, [courseId, numberOfAnnouncements]);

  const handleAnnouncementClick = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedAnnouncement(null);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Latest Announcements
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Stay updated with recent course announcements
            </p>
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(numberOfAnnouncements)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2 w-3/4"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-3 w-full"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-red-500 to-red-600 rounded-xl">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Latest Announcements
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Stay updated with recent course announcements
            </p>
          </div>
        </div>
        <div className="text-center py-8">
          <div className="text-red-500 dark:text-red-400 text-sm font-medium">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Latest Announcements
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Stay updated with recent course announcements
            </p>
          </div>
        </div>
        <div className="text-center py-8">
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            No announcements yet.
          </div>
        </div>
      </div>
    );
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Latest Announcements
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Stay updated with recent course announcements
            </p>
          </div>
        </div>
        
        <div className="space-y-4">
          {announcements.map((announcement, index) => (
            <div
              key={announcement._id}
              className="group relative bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-700 transition-all duration-200 cursor-pointer"
              onClick={() => handleAnnouncementClick(announcement)}
            >
              {/* Priority indicator for first announcement */}
              {index === 0 && (
                <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}
              
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-gray-900 dark:text-white text-lg leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {announcement.title}
                </h4>
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                  <Clock className="w-3 h-3" />
                  {formatTimeAgo(announcement.createdAt)}
                </div>
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed line-clamp-3">
                {announcement.body.replace(/<[^>]+>/g, '').substring(0, 200)}
                {announcement.body.replace(/<[^>]+>/g, '').length > 200 && '...'}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {announcement.author.firstName} {announcement.author.lastName}
                  </span>
                </div>
                
                <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Read more</span>
                  <ExternalLink className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Announcement Detail Modal */}
      <AnnouncementDetailModal
        isOpen={showDetailModal}
        onClose={handleCloseModal}
        announcement={selectedAnnouncement}
      />
    </>
  );
};

export default LatestAnnouncements; 