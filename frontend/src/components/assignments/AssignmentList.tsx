import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { API_URL } from '../../config';

interface Attachment {
  _id: string;
  filename: string;
  path: string;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
}

interface Assignment {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  attachments: Attachment[];
  createdBy: User;
}

interface AssignmentListProps {
  moduleId?: string;
  assignments?: Assignment[];
  userRole?: string;
  studentSubmissions?: any[];
  studentId?: string;
  submissionMap?: { [key: string]: string };
  courseId?: string;
}

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Published', value: 'published' },
  { label: 'Unpublished', value: 'unpublished' },
  { label: 'Assignments', value: 'assignment' },
  { label: 'Discussions', value: 'discussion' },
];

const AssignmentList: React.FC<AssignmentListProps> = ({ moduleId, assignments: propAssignments, userRole, studentSubmissions, studentId, submissionMap, courseId }) => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupedAssignments, setGroupedAssignments] = useState<{ label: string; items: any[] }[]>([]);

  const isTeacherOrAdmin = userRole === 'teacher' || userRole === 'admin';

  const handleRowClick = (item: any, event: React.MouseEvent) => {
    // Don't navigate if clicking on checkbox or action buttons
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.closest('a') || target.closest('button')) {
      return;
    }
    
    // Navigate to assignment details first
    if (item.type === 'discussion') {
      if (courseId) {
        navigate(`/courses/${courseId}/threads/${item._id}`);
      } else {
        navigate(`/discussions/${item._id}/view`);
      }
    } else {
      // For assignments, go to details page first
      navigate(`/assignments/${item._id}`);
    }
  };

  useEffect(() => {
    if (propAssignments) {
      setLoading(false);
      return;
    }
    if (!moduleId) return;
    const fetchAssignments = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`/api/assignments/module/${moduleId}`,
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
        );
        setAssignments(response.data);
        // Fetch graded discussions (threads)
        let threadsRes;
        try {
          threadsRes = await axios.get(`/api/threads/module/${moduleId}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
        } catch (e) {
          // fallback if /api/threads/module/:moduleId does not exist
          threadsRes = await axios.get(`/api/threads?module=${moduleId}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
        }
        // Only include graded discussions
        const gradedDiscussions = (threadsRes.data || []).filter((thread: any) => thread.isGraded);
        setDiscussions(gradedDiscussions);
        setLoading(false);
      } catch (err) {
        setError('Error fetching assignments');
        setLoading(false);
      }
    };
    fetchAssignments();
  }, [moduleId, propAssignments]);

  useEffect(() => {
    const mergedList = [
      ...(propAssignments ? propAssignments : assignments).map(a => ({
        _id: a._id,
        title: a.title,
        dueDate: a.dueDate || (a as any).due_date || (a as any).discussionDueDate || null,
        attachments: a.attachments || [],
        createdBy: a.createdBy,
        type: ((a as any).type === 'discussion' || (a as any).group === 'Discussions') ? 'discussion' : 'assignment',
        group: (a as any).group || 'Assignments',
        totalPoints: (a as any).totalPoints || (a as any).points || 0,
        published: (a as any).published !== undefined ? (a as any).published : true,
        replies: (a as any).replies || [],
        studentGrades: (a as any).studentGrades || [],
      })),
      ...discussions.map(d => ({
        _id: d._id,
        title: d.title,
        dueDate: d.dueDate || (d as any).due_date || (d as any).discussionDueDate || null,
        attachments: [],
        createdBy: d.author || { firstName: '', lastName: '' },
        type: 'discussion',
        group: d.group || 'Discussions',
        totalPoints: d.totalPoints || 0,
        published: d.published !== undefined ? d.published : true,
        replies: d.replies || [],
        studentGrades: d.studentGrades || [],
      }))
    ];
    const filteredList = mergedList.filter(item => {
      if (selectedTab === 'all') return true;
      if (selectedTab === 'published') return item.published;
      if (selectedTab === 'unpublished') return !item.published;
      if (selectedTab === 'assignment') return item.type === 'assignment';
      if (selectedTab === 'discussion') return item.type === 'discussion';
      return true;
    });
    filteredList.sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      } else if (a.dueDate) {
        return -1;
      } else if (b.dueDate) {
        return 1;
      } else {
        return a.title.localeCompare(b.title);
      }
    });
    const now = new Date();
    const isSubmittedFn = (item: any) => {
      if (item.type === 'discussion') {
        const hasGrade = Array.isArray(item.studentGrades) && item.studentGrades.some((g: any) => g.student && (g.student._id === studentId || g.student === studentId));
        const hasReply = Array.isArray(item.replies) && item.replies.some((r: any) => r.author && (r.author._id === studentId || r.author === studentId));
        return hasGrade || hasReply;
      }
      if (submissionMap) {
        return !!submissionMap[`${studentId}_${item._id}`];
      } else if (studentSubmissions) {
        return new Set(studentSubmissions.map(s => String(s.assignment && (s.assignment._id || s.assignment)))).has(String(item._id));
      }
      return false;
    };
    const submitted: any[] = [];
    const upcoming: any[] = [];
    const missing: any[] = [];
    filteredList.forEach(item => {
      const isSubmitted = isSubmittedFn(item);
      const dueDate = item.dueDate ? new Date(item.dueDate) : null;
      if (isSubmitted) {
        submitted.push(item);
      } else if (dueDate && dueDate < now) {
        missing.push(item);
      } else {
        upcoming.push(item);
      }
    });
    const groups: { label: string; items: any[] }[] = [];
    if (upcoming.length > 0) groups.push({ label: 'Upcoming', items: upcoming });
    if (missing.length > 0) groups.push({ label: 'Missing', items: missing });
    if (submitted.length > 0) groups.push({ label: 'Submitted', items: submitted });
    setGroupedAssignments(groups);
  }, [propAssignments, assignments, discussions, studentSubmissions, submissionMap, studentId, userRole, selectedTab]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  // Bulk actions (UI only, logic to be implemented as needed)
  const allSelected = selectedIds.length === groupedAssignments.length && groupedAssignments.length > 0;
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : groupedAssignments.map(group => group.label));
  };
  const toggleSelect = (id: string) => {
    setSelectedIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
  };

  // Dummy bulk action handlers
  const handleBulkPublish = async () => {
    const token = localStorage.getItem('token');
    try {
      await Promise.all(selectedIds.map(async (id) => {
        // Find the item in the flatList to determine its type
        const item = flatList.find(a => a._id === id);
        if (item?.type === 'discussion') {
          await axios.patch(
            `${API_URL}/api/threads/${id}/publish`,
            { published: true },
            token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
          );
        } else {
          await axios.patch(
            `${API_URL}/api/assignments/${id}/publish`,
            { published: true },
            token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
          );
        }
      }));
      alert('Selected items published!');
      window.location.reload();
    } catch (err) {
      alert('Error publishing selected items.');
    }
  };
  const handleBulkUnpublish = async () => {
    const token = localStorage.getItem('token');
    try {
      await Promise.all(selectedIds.map(async (id) => {
        const item = flatList.find(a => a._id === id);
        if (item?.type === 'discussion') {
          await axios.patch(
            `${API_URL}/api/threads/${id}/publish`,
            { published: false },
            token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
          );
        } else {
          await axios.patch(
            `${API_URL}/api/assignments/${id}/publish`,
            { published: false },
            token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
          );
        }
      }));
      alert('Selected items unpublished!');
      window.location.reload();
    } catch (err) {
      alert('Error unpublishing selected items.');
    }
  };
  const handleBulkDelete = async () => {
    const token = localStorage.getItem('token');
    if (!window.confirm('Are you sure you want to delete the selected items? This cannot be undone.')) return;
    try {
      await Promise.all(selectedIds.map(async (id) => {
        try {
          await axios.delete(`/api/assignments/${id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
        } catch (e) {
          try {
            await axios.delete(`/api/threads/${id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
          } catch (err) {
            // Ignore if both fail
          }
        }
      }));
      alert('Selected items deleted!');
      window.location.reload();
    } catch (err) {
      alert('Error deleting selected items.');
    }
  };

  // Filtering and sorting logic for both roles
  const filterList = (list: any[]) => {
    return list.filter(item => {
      if (selectedTab === 'all') return true;
      if (selectedTab === 'published') return item.published;
      if (selectedTab === 'unpublished') return !item.published;
      if (selectedTab === 'assignment') return item.type === 'assignment';
      if (selectedTab === 'discussion') return item.type === 'discussion';
      return true;
    });
  };

  // For teacher/admin, normalize and filter the flat list
  const flatList = filterList(
    (propAssignments ? propAssignments : assignments).map(item => ({
      _id: item._id,
      title: item.title,
      dueDate: item.dueDate || (item as any).due_date || (item as any).discussionDueDate || null,
      attachments: item.attachments || [],
      createdBy: item.createdBy || (item as any).author || { firstName: '', lastName: '' },
      type: ((item as any).type === 'discussion' || (item as any).group === 'Discussions') ? 'discussion' : 'assignment',
      group: (item as any).group || 'Assignments',
      totalPoints: (item as any).totalPoints || (item as any).points || 0,
      published: (item as any).published !== undefined ? (item as any).published : true,
      replies: (item as any).replies || [],
      studentGrades: (item as any).studentGrades || [],
    }))
  );

  // For students, filter grouped assignments as before
  const filteredGroupedAssignments = userRole === 'student' && groupedAssignments.length > 0
    ? groupedAssignments.map(group => ({
        ...group,
        items: filterList(group.items)
      })).filter(group => group.items.length > 0)
    : [];

  // Function to generate consistent color for any group name
  const getGroupColor = (groupName: string) => {
    // Create a hash from the group name to generate consistent colors
    let hash = 0;
    for (let i = 0; i < groupName.length; i++) {
      hash = groupName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Use the hash to select from a predefined set of colors
    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-purple-100 text-purple-700', 
      'bg-green-100 text-green-700',
      'bg-orange-100 text-orange-700',
      'bg-pink-100 text-pink-700',
      'bg-indigo-100 text-indigo-700',
      'bg-teal-100 text-teal-700',
      'bg-yellow-100 text-yellow-700',
      'bg-red-100 text-red-700',
      'bg-gray-100 text-gray-700'
    ];
    
    const colorIndex = Math.abs(hash) % colors.length;
    return colors[colorIndex];
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      {isTeacherOrAdmin && (
        <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700 mb-4">
          {TABS.map(tab => (
            <button
              key={tab.value}
              className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm focus:outline-none ${selectedTab === tab.value ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
              onClick={() => setSelectedTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Bulk Actions (only for teacher/admin) */}
      {isTeacherOrAdmin && selectedIds.length > 0 && (
        <div className="flex space-x-2 mb-2">
          <button onClick={handleBulkPublish} className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">Publish</button>
          <button onClick={handleBulkUnpublish} className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">Unpublish</button>
          <button onClick={handleBulkDelete} className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Delete</button>
        </div>
      )}

      {/* Table View */}
      <div className="overflow-x-auto bg-white dark:bg-gray-900 shadow rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {isTeacherOrAdmin && (
                <th className="px-4 py-2">
                  <input type="checkbox" id="select-all-assignments" name="selectAll" checked={allSelected} onChange={toggleSelectAll} />
                </th>
              )}
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Group</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
              {isTeacherOrAdmin && <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>}
              {isTeacherOrAdmin && <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {userRole === 'student' && filteredGroupedAssignments.length > 0 ? (
              filteredGroupedAssignments.map(group => [
                <tr key={group.label}>
                  <td colSpan={5} className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold py-2 pl-2">{group.label}</td>
                </tr>,
                ...group.items.map(item => {
                  const dueDate = item.dueDate ? new Date(item.dueDate) : null;
                  return (
                    <tr
                      key={item._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      onClick={(e) => handleRowClick(item, e)}
                    >
                      <td className="px-4 py-2">
                        <span className="text-indigo-700 font-medium hover:underline">{item.title}</span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getGroupColor(item.group)}`}>
                          {item.group}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{dueDate ? format(dueDate, 'PPp') : '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{item.totalPoints}</td>
                    </tr>
                  );
                })
              ])
            ) : isTeacherOrAdmin ? (
              flatList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-gray-400">No assignments found</td>
                </tr>
              ) : (
                flatList.map(item => {
                  const dueDate = item.dueDate ? new Date(item.dueDate) : null;
                  return (
                    <tr
                      key={item._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      onClick={(e) => handleRowClick(item, e)}
                    >
                      <td className="px-4 py-2">
                        <input type="checkbox" id={`select-assignment-${item._id}`} name={`select-${item._id}`} checked={selectedIds.includes(item._id)} onChange={() => toggleSelect(item._id)} />
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-indigo-700 font-medium hover:underline">{item.title}</span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getGroupColor(item.group)}`}>
                          {item.group}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{dueDate ? format(dueDate, 'PPp') : '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{item.totalPoints}</td>
                      <td className="px-4 py-2">
                        {item.published ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Published</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">Unpublished</span>
                        )}
                      </td>
                      <td className="px-4 py-2 space-x-2">
                        {/* Edit button (only for teacher/admin) */}
                        {isTeacherOrAdmin && item.type === 'assignment' && (
                          <Link
                            to={`/assignments/${item._id}/edit`}
                            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800"
                            style={{ textDecoration: 'none' }}
                          >
                            Edit
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )
            ) : (
              <tr>
                <td colSpan={isTeacherOrAdmin ? 7 : 5} className="text-center py-6 text-gray-400">No assignments found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AssignmentList;