import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import CreatePageForm from '../CreatePageForm';
import { ModuleProvider } from '../../contexts/ModuleContext';
import { getGroupSetAnnouncements } from '../../services/announcementService';
import AnnouncementList from '../announcements/AnnouncementList';
import { FileText } from 'lucide-react';

// Detect mobile device
const useMobileDevice = () => {
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobileDevice;
};

interface GroupPagesProps {
  groupSetId: string;
  groupId: string;
  isInstructor: boolean;
}

const GroupPages: React.FC<GroupPagesProps> = ({ groupSetId, groupId, isInstructor }) => {
  const navigate = useNavigate();
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [modules, setModules] = useState<any[]>([]);
  const [courseId, setCourseId] = useState('');
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const isMobileDevice = useMobileDevice();

  useEffect(() => {
    const fetchPages = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await api.get(`/pages/groupset/${groupSetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPages(res.data.data || []);
      } catch (err) {
        setPages([]);
      } finally {
        setLoading(false);
      }
    };
    if (groupSetId) fetchPages();
  }, [groupSetId, showCreate]);

  useEffect(() => {
    // Fetch modules and courseId for the group
    const fetchGroupInfo = async () => {
      if (!groupId) return;
      try {
        const token = localStorage.getItem('token');
        const res = await api.get(`/groups/${groupId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCourseId(res.data.course?._id || res.data.course || '');
        // Optionally fetch modules for the course
        if (res.data.course?._id || res.data.course) {
          const courseId = res.data.course?._id || res.data.course;
          const modulesRes = await api.get(`/modules/${courseId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setModules(modulesRes.data.data || []);
        }
      } catch (err) {
        setCourseId('');
        setModules([]);
      }
    };
    fetchGroupInfo();
  }, [groupId]);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      if (!courseId || !groupSetId) return;
      setAnnouncementsLoading(true);
      try {
        const data = await getGroupSetAnnouncements(courseId, groupSetId);
        setAnnouncements(data);
      } catch {
        setAnnouncements([]);
      } finally {
        setAnnouncementsLoading(false);
      }
    };
    fetchAnnouncements();
  }, [courseId, groupSetId]);

  return (
    <div className={`w-full h-full overflow-y-auto ${isMobileDevice ? 'pb-20' : ''}`}>
      {/* Header - Mobile Optimized */}
      <div className={`bg-white dark:bg-gray-800 ${isMobileDevice ? 'p-3 mb-3 border-b' : 'p-4 sm:p-6 mb-4 sm:mb-6'} border-gray-200 dark:border-gray-700`}>
        <div className="flex flex-col gap-3">
        <div>
            <h2 className={`${isMobileDevice ? 'text-lg' : 'text-xl sm:text-2xl'} font-bold text-gray-800 dark:text-gray-100`}>
              Group Pages
            </h2>
            {!isMobileDevice && (
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
                Pages shared with this group set
              </p>
            )}
        </div>
        {isInstructor && (
          <button
            onClick={() => setShowCreate(true)}
              className={`${isMobileDevice ? 'w-full px-4 py-2.5 text-sm' : 'w-full sm:w-auto px-4 py-2 text-sm sm:text-base'} bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 transition-all flex items-center justify-center gap-2 font-semibold shadow-md hover:shadow-lg active:scale-95 touch-manipulation`}
          >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Page
          </button>
        )}
        </div>
      </div>
      {showCreate && (
        <ModuleProvider>
          <CreatePageForm
            modules={modules}
            courseId={courseId}
            onSuccess={() => setShowCreate(false)}
            onCancel={() => setShowCreate(false)}
          />
        </ModuleProvider>
      )}
      <div className={`${isMobileDevice ? 'px-4' : 'px-4 sm:px-6'} pb-4 sm:pb-6`}>
      {loading ? (
          <div className={`text-center ${isMobileDevice ? 'py-8' : 'py-12'} text-gray-500 dark:text-gray-400`}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-blue-400 mx-auto"></div>
            <p className="mt-2 text-sm">Loading pages...</p>
          </div>
      ) : pages.length === 0 ? (
          <div className={`text-center ${isMobileDevice ? 'py-12 px-4' : 'py-16'} bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600`}>
          <div className="flex flex-col items-center">
              <div className={`${isMobileDevice ? 'w-12 h-12' : 'w-16 h-16'} bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4`}>
                <FileText className={`${isMobileDevice ? 'h-6 w-6' : 'h-8 w-8'} text-blue-600 dark:text-blue-400`} />
              </div>
              <h3 className={`${isMobileDevice ? 'text-base' : 'text-lg'} font-bold text-gray-900 dark:text-gray-100 mb-2`}>
                No pages yet
              </h3>
              <p className={`${isMobileDevice ? 'text-xs px-2' : 'text-sm max-w-md'} text-gray-600 dark:text-gray-400`}>
              {isInstructor 
                ? "Get started by creating a page to share with this group set."
                : "There are no pages available for this group set yet."}
            </p>
          </div>
        </div>
      ) : (
          <div className={`${isMobileDevice ? 'space-y-3' : 'space-y-4'}`}>
          {pages.map(page => (
              <div 
                key={page._id} 
                onClick={() => navigate(`/pages/${page._id}`)}
                className={`${isMobileDevice ? 'p-3' : 'p-4'} bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-lg transition-all cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 active:scale-[0.98] group touch-manipulation`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`${isMobileDevice ? 'p-2' : 'p-2.5'} bg-blue-100 dark:bg-blue-900/50 rounded-lg flex-shrink-0`}>
                    <FileText className={`${isMobileDevice ? 'w-4 h-4' : 'w-5 h-5'} text-blue-600 dark:text-blue-400`} />
                  </div>
                  <span className={`${isMobileDevice ? 'text-sm' : 'text-base'} group-hover:text-blue-600 dark:group-hover:text-blue-400 font-medium text-gray-900 dark:text-gray-100 flex-1 truncate transition-colors`}>
                    {page.title}
                  </span>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

export default GroupPages; 