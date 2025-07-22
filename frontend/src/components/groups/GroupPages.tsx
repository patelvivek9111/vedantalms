import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import CreatePageForm from '../CreatePageForm';
import { ModuleProvider } from '../../contexts/ModuleContext';
import { getGroupSetAnnouncements } from '../../services/announcementService';
import AnnouncementList from '../announcements/AnnouncementList';
import { FileText } from 'lucide-react';

interface GroupPagesProps {
  groupSetId: string;
  groupId: string;
  isInstructor: boolean;
}

const GroupPages: React.FC<GroupPagesProps> = ({ groupSetId, groupId, isInstructor }) => {
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [modules, setModules] = useState<any[]>([]);
  const [courseId, setCourseId] = useState('');
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);

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
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Group Pages</h2>
          <p className="text-gray-600 mt-1">Pages shared with this group set</p>
        </div>
        {isInstructor && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            + Create Page
          </button>
        )}
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
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading pages...</div>
      ) : pages.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No pages available for this group set.</div>
      ) : (
        <div className="divide-y">
          {pages.map(page => (
            <div key={page._id} className="p-4 hover:bg-gray-50 flex justify-between items-center group">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <span className="group-hover:text-blue-500 font-medium">{page.title}</span>
              </div>
              {/* Add view/edit/delete buttons as needed */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupPages; 