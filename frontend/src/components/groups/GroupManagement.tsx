import React, { useState, useEffect } from 'react';
import { getMemoryAuthToken, authFetchInit } from '../../utils/authToken';
import { Plus, Users, Trash2, Edit2, UserPlus, Shuffle, MessageSquare, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import ConfirmationModal from '../common/ConfirmationModal';

interface GroupSet {
  _id: string;
  name: string;
  course: string;
  allowSelfSignup: boolean;
  groupStructure?: string;
}

interface Group {
  _id: string;
  name: string;
  groupSet: string;
  members: User[];
  leader: User;
  groupId: string;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface GroupManagementProps {
  courseId: string;
}

interface GroupActivity {
  submissions: Array<{
    _id: string;
    assignment: {
      title: string;
      dueDate: string;
    };
    submittedAt: string;
    status: string;
  }>;
  discussions: Array<{
    _id: string;
    title: string;
    content: string;
    author: User;
    createdAt: string;
  }>;
}

const GroupManagement: React.FC<GroupManagementProps> = ({ courseId }) => {
  const location = useLocation();
  const [groupSets, setGroupSets] = useState<GroupSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<GroupSet | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateSetModal, setShowCreateSetModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showAutoSplitModal, setShowAutoSplitModal] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [groupSize, setGroupSize] = useState(4);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [allowSelfSignup, setAllowSelfSignup] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupActivity, setGroupActivity] = useState<GroupActivity | null>(null);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupStructure, setGroupStructure] = useState('manual');
  const [groupCount, setGroupCount] = useState(2);
  const [studentsPerGroup, setStudentsPerGroup] = useState(2);

  const navigate = useNavigate();

  // Fetch group sets and students
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = getMemoryAuthToken();
        const [setsRes, studentsRes, courseRes] = await Promise.all([
          api.get(`/groups/sets/${courseId}`),
          api.get(`/courses/${courseId}/students`),
          api.get(`/courses/${courseId}`)
        ]);
        setGroupSets(setsRes.data);
        setStudents(studentsRes.data);
        if (courseRes.data.success) {
          setCourse(courseRes.data.data);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [courseId]);

  // Fetch groups when a set is selected
  useEffect(() => {
    const fetchGroups = async () => {
      if (!selectedSet) return;
      try {
        const token = getMemoryAuthToken();
        const response = await api.get(`/groups/sets/${selectedSet._id}/groups`);
        setGroups(response.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading groups');
      }
    };
    fetchGroups();
  }, [selectedSet]);


  const handleCreateSet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = getMemoryAuthToken();
      const payload: any = {
        name: newSetName,
        courseId,
        allowSelfSignup
      };
      // Only add groupStructure if not manual
      if (groupStructure === 'byGroupCount' || groupStructure === 'byStudentsPerGroup') {
        payload.groupStructure = groupStructure;
      } else {
        payload.groupStructure = 'manual';
      }
      if (groupStructure === 'byGroupCount') payload.groupCount = groupCount;
      if (groupStructure === 'byStudentsPerGroup') payload.studentsPerGroup = studentsPerGroup;
      const response = await api.post(
        `/groups/sets`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (response.data.groupSet) {
        setGroupSets([...groupSets, response.data.groupSet]);
        setSelectedSet(response.data.groupSet);
        setGroups(response.data.groups || []);
      } else {
        setGroupSets([...groupSets, response.data]);
        setSelectedSet(response.data);
        setGroups([]);
      }
      setShowCreateSetModal(false);
      setNewSetName('');
      setAllowSelfSignup(false);
      setGroupStructure('manual');
      setGroupCount(2);
      setStudentsPerGroup(2);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error creating group set');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSet) return;
    // Generate a unique groupId for each group (future-proof)
    const groupId = `${newGroupName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    let payload: any = { name: newGroupName, groupId };
    if (selectedSet.groupStructure !== 'manual') {
      if (selectedStudents.length === 0) {
        setError("Please select at least one member.");
        return;
      }
      payload.members = selectedStudents;
      payload.leader = selectedStudents[0];
    }
    try {
      const token = getMemoryAuthToken();
      const response = await api.post(
        `/groups/sets/${selectedSet._id}/groups`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setGroups([...groups, response.data]);
      setShowCreateGroupModal(false);
      setNewGroupName('');
      setSelectedStudents([]);
      // Redirect to the new group's page
      navigate(`/groups/${response.data._id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Error creating group');
    }
  };

  const handleAutoSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSet) return;
    try {
      const token = getMemoryAuthToken();
      const response = await api.post(
        `/groups/sets/${selectedSet._id}/auto-split`,
        {
          groupSize,
          students: students.map(s => s._id)
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setGroups(response.data);
      setShowAutoSplitModal(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error auto-splitting students');
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    setGroupToDelete(groupId);
    setShowDeleteGroupConfirm(true);
  };

  const confirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    setShowDeleteGroupConfirm(false);
    try {
      const token = getMemoryAuthToken();
      await api.delete(`/groups/${groupToDelete}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(groups.filter(g => g._id !== groupToDelete));
      setGroupToDelete(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error deleting group');
    }
  };

  const handleEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    try {
      const token = getMemoryAuthToken();
      const response = await api.put(
        `/groups/${selectedGroup._id}`,
        {
          name: newGroupName,
          leader: selectedStudents[0],
          members: selectedStudents
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setGroups(groups.map(g => g._id === selectedGroup._id ? response.data : g));
      setShowEditGroupModal(false);
      setSelectedGroup(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error updating group');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    try {
      const token = getMemoryAuthToken();
      await api.post(
        `/groups/${selectedGroup._id}/message`,
        {
          subject: messageSubject,
          content: messageContent
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setShowMessageModal(false);
      setMessageSubject('');
      setMessageContent('');
      setSelectedGroup(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error sending message');
    }
  };

  const handleViewActivity = async (groupId: string) => {
    try {
      const token = getMemoryAuthToken();
      const response = await api.get(
        `/groups/${groupId}/activity`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setGroupActivity(response.data);
      setShowActivityModal(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error loading group activity');
    }
  };

  const toggleGroupExpand = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // Drag-and-drop handler
  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    // Only handle student drag to group for manual group sets
    if (selectedSet && selectedSet.groupStructure === 'manual') {
      // If dropped in a group
      if (destination.droppableId.startsWith('group-')) {
        const destGroupId = destination.droppableId.replace('group-', '');
        const student = students.find(s => s._id === draggableId);
        if (!student) return;

        // Find the source group (if any)
        const sourceGroup = groups.find(g => g.members.some(m => m._id === student._id));
        const destGroup = groups.find(g => g._id === destGroupId);
        if (!destGroup) return;

        // Remove student from source group (if exists)
        let updatedGroups = groups.map(g => {
          if (sourceGroup && g._id === sourceGroup._id) {
            return { ...g, members: g.members.filter(m => m._id !== student._id) };
          }
          return g;
        });

        // Add student to the destination group
        updatedGroups = updatedGroups.map(g => {
          if (g._id === destGroupId) {
            // Prevent duplicate
            if (!g.members.some(m => m._id === student._id)) {
              return { ...g, members: [...g.members, student] };
            }
          }
          return g;
        });

        setGroups(updatedGroups);

        // Persist the changes to the backend
        try {
          const token = getMemoryAuthToken();
          // Update source group if student was in a group
          if (sourceGroup && sourceGroup._id !== destGroupId) {
            const newSourceMembers = updatedGroups.find(g => g._id === sourceGroup._id)?.members.map(m => m._id) || [];
            await api.put(
              `/groups/${sourceGroup._id}`,
              {
                members: newSourceMembers,
                leader: newSourceMembers[0] || null
              },
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            );
          }
          // Update destination group
          const newDestMembers = updatedGroups.find(g => g._id === destGroupId)?.members.map(m => m._id) || [];
          await api.put(
            `/groups/${destGroupId}`,
            {
              members: newDestMembers,
              leader: newDestMembers[0] || null
            },
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );
          // Re-fetch groups to ensure sync
          const response = await api.get(`/groups/sets/${selectedSet._id}/groups`);
          setGroups(response.data);
        } catch (err: any) {
          setError(err.response?.data?.message || 'Error updating group');
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-5 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/70">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Create and manage group sets for this course</p>
          <button
            onClick={() => setShowCreateSetModal(true)}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Group Set
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 sm:px-4 sm:py-3 sm:text-base">
            {error}
          </div>
        )}

        {/* Group Sets List */}
        <div className="mb-6 sm:mb-8">
        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupSets.map(set => (
            <div
              key={set._id}
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                selectedSet?._id === set._id
                  ? 'border-blue-500 bg-blue-50/80 shadow-sm dark:border-blue-400 dark:bg-blue-900/20'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600 dark:hover:bg-gray-800'
              }`}
              onClick={() => setSelectedSet(set)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 break-words">{set.name}</h4>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {set.allowSelfSignup ? 'Self-signup enabled' : 'Self-signup disabled'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>

        {/* Groups List */}
        {selectedSet && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Sidebar: Student List (only for manual group sets) */}
            {selectedSet.groupStructure === 'manual' && (
              <div className="h-fit w-full rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-800/70 lg:w-72">
                <h4 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Students</h4>
                <Droppable droppableId="students-list">
                  {(provided) => (
                    <ul ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 min-h-[40px]">
                      {students.filter(s => !groups.some(g => g.members.some(m => m._id === s._id))).map((student, idx) => (
                        <Draggable key={student._id} draggableId={student._id} index={idx}>
                          {(provided) => (
                            <li
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="flex cursor-move items-center gap-2 rounded-lg border border-gray-200 bg-white p-2.5 text-sm text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
                            >
                              <Users className="h-4 w-4 text-gray-400" />
                              {student.firstName} {student.lastName}
                            </li>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </ul>
                  )}
                </Droppable>
              </div>
            )}

            {/* Main: Groups List */}
            <div className="flex-1">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Groups in {selectedSet.name}</h3>
                {selectedSet.groupStructure === 'manual' && (
                  <button
                    onClick={() => setShowCreateGroupModal(true)}
                    className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Group
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map(group => (
                  <Droppable key={group._id} droppableId={`group-${group._id}`}>
                    {(provided) => (
                      <div
                        key={group._id}
                        className="cursor-pointer rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600 dark:hover:bg-gray-800"
                        onClick={e => {
                          // Prevent navigation if clicking the expand/collapse button
                          if ((e.target as HTMLElement).closest('button')) return;
                          navigate(`/groups/${group._id}`);
                        }}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => toggleGroupExpand(group._id)}
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                            >
                              {expandedGroups.has(group._id) ? (
                                <ChevronUp className="h-5 w-5" />
                              ) : (
                                <ChevronDown className="h-5 w-5" />
                              )}
                            </button>
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">{group.name}</h4>
                          </div>
                        </div>
                        {expandedGroups.has(group._id) && (
                          <div className="space-y-2 mt-2">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Members</p>
                            <ul className="max-h-[9rem] space-y-1 overflow-y-auto overscroll-y-contain pr-0.5 text-sm text-gray-600 dark:text-gray-300">
                              {group.members.map((member, idx) => (
                                <Draggable key={member._id} draggableId={member._id} index={idx}>
                                  {(provided) => (
                                    <li
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-800"
                                    >
                                      {/* 6-dot drag handle */}
                                      <span
                                        {...provided.dragHandleProps}
                                        className="cursor-grab px-1 text-gray-400 flex items-center"
                                        aria-label="Drag handle"
                                      >
                                        {/* SVG for 6 dots */}
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          <circle cx="4" cy="4" r="1" fill="currentColor"/>
                                          <circle cx="4" cy="8" r="1" fill="currentColor"/>
                                          <circle cx="4" cy="12" r="1" fill="currentColor"/>
                                          <circle cx="8" cy="4" r="1" fill="currentColor"/>
                                          <circle cx="8" cy="8" r="1" fill="currentColor"/>
                                          <circle cx="8" cy="12" r="1" fill="currentColor"/>
                                        </svg>
                                      </span>
                                      <Users className="h-4 w-4 text-gray-400" />
                                      {member.firstName} {member.lastName}
                                    </li>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>
            </div>
          </div>
        </DragDropContext>
        )}
      </div>

      {/* Create Group Set Modal */}
      {showCreateSetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="max-h-[95vh] w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create Group Set</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Name your set and choose how groups are formed.</p>
            </div>
            <form onSubmit={handleCreateSet}>
              <div className="space-y-5 px-6 py-5">
                <div>
                  <label htmlFor="new-set-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                  <input
                    type="text"
                    id="new-set-name"
                    name="newSetName"
                    value={newSetName}
                    onChange={(e) => setNewSetName(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                    required
                  />
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50/90 px-4 py-3 dark:border-gray-600 dark:bg-gray-800/60">
                  <label htmlFor="allow-self-signup" className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      id="allow-self-signup"
                      name="allowSelfSignup"
                      checked={allowSelfSignup}
                      onChange={(e) => setAllowSelfSignup(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">Allow self-signup</span>
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">Students can join a group in this set on their own when enabled.</span>
                    </span>
                  </label>
                </div>
                <div>
                  <label htmlFor="groupStructure" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Group structure</label>
                  <select
                    id="groupStructure"
                    name="groupStructure"
                    value={groupStructure}
                    onChange={e => setGroupStructure(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="manual">Create groups later</option>
                    <option value="byGroupCount">Split students by number of groups</option>
                    <option value="byStudentsPerGroup">Split number of students per group</option>
                  </select>
                </div>
                {groupStructure === 'byGroupCount' && (
                  <div>
                    <label htmlFor="groupCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Number of groups</label>
                    <input
                      id="groupCount"
                      name="groupCount"
                      type="number"
                      min={2}
                      value={groupCount}
                      onChange={e => setGroupCount(Number(e.target.value))}
                      className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      required
                    />
                  </div>
                )}
                {groupStructure === 'byStudentsPerGroup' && (
                  <div>
                    <label htmlFor="studentsPerGroup" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Students per group
                    </label>
                    <input
                      id="studentsPerGroup"
                      name="studentsPerGroup"
                      type="number"
                      min={2}
                      value={studentsPerGroup}
                      onChange={e => setStudentsPerGroup(Number(e.target.value))}
                      className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      required
                    />
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      Minimum 2 students per group.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50/90 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
                <button
                  type="button"
                  onClick={() => setShowCreateSetModal(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && selectedSet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="max-h-[95vh] w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create group</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Add a group to &ldquo;{selectedSet.name}&rdquo;.</p>
            </div>
            <form onSubmit={handleCreateGroup}>
              <div className="space-y-5 px-6 py-5">
                <div>
                  <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Group name</label>
                  <input
                    id="groupName"
                    name="groupName"
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    required
                  />
                </div>
                {selectedSet.groupStructure !== 'manual' && (
                  <div>
                    <label htmlFor="groupMembers" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select members</label>
                    <select
                      id="groupMembers"
                      name="groupMembers"
                      multiple
                      value={selectedStudents}
                      onChange={(e) => setSelectedStudents(
                        Array.from(e.target.selectedOptions, option => option.value)
                      )}
                      className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      size={5}
                    >
                      {students.map(student => (
                        <option key={student._id} value={student._id}>
                          {student.firstName} {student.lastName}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      Hold Ctrl/Cmd to select multiple students.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50/90 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auto-split Modal */}
      {showAutoSplitModal && selectedSet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="max-h-[95vh] w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Auto-split students</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Randomly assign enrolled students into groups of a fixed size.</p>
            </div>
            <form onSubmit={handleAutoSplit}>
              <div className="px-6 py-5">
                <label htmlFor="auto-split-group-size" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Group size</label>
                <input
                  type="number"
                  id="auto-split-group-size"
                  name="groupSize"
                  min="2"
                  max={students.length}
                  value={groupSize}
                  onChange={(e) => setGroupSize(parseInt(e.target.value))}
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  required
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Students will be randomly assigned to groups of this size.
                </p>
              </div>
              <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50/90 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
                <button
                  type="button"
                  onClick={() => setShowAutoSplitModal(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Auto-split
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroupModal && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="max-h-[95vh] w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit group</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update the name and roster for this group.</p>
            </div>
            <form onSubmit={handleEditGroup}>
              <div className="space-y-5 px-6 py-5">
                <div>
                  <label htmlFor="editGroupName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Group name</label>
                  <input
                    id="editGroupName"
                    name="editGroupName"
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="editGroupMembers" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select members</label>
                  <select
                    id="editGroupMembers"
                    name="editGroupMembers"
                    multiple
                    value={selectedStudents}
                    onChange={(e) => setSelectedStudents(
                      Array.from(e.target.selectedOptions, option => option.value)
                    )}
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    size={5}
                  >
                    {students.map(student => (
                      <option key={student._id} value={student._id}>
                        {student.firstName} {student.lastName}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    First selected student is the group leader.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50/90 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditGroupModal(false);
                    setSelectedGroup(null);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Message Group Modal */}
      {showMessageModal && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="max-h-[95vh] w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Message group</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedGroup.name}</p>
            </div>
            <form onSubmit={handleSendMessage}>
              <div className="space-y-5 px-6 py-5">
                <div>
                  <label htmlFor="message-subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
                  <input
                    id="message-subject"
                    type="text"
                    value={messageSubject}
                    onChange={(e) => setMessageSubject(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="message-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
                  <textarea
                    id="message-content"
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    rows={4}
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50/90 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
                <button
                  type="button"
                  onClick={() => {
                    setShowMessageModal(false);
                    setSelectedGroup(null);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Send message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Activity Modal */}
      {showActivityModal && groupActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="max-h-[95vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 sm:max-h-[80vh]">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Group activity</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Recent submissions and discussions.</p>
            </div>
            <div className="max-h-[calc(80vh-8rem)] overflow-y-auto px-6 py-5">
              <div className="mb-6">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Submissions</h4>
                {groupActivity.submissions.length > 0 ? (
                  <div className="space-y-2">
                    {groupActivity.submissions.map(submission => (
                      <div key={submission._id} className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-600 dark:bg-gray-800/60">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{submission.assignment.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Submitted: {new Date(submission.submittedAt).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Status: <span className={`font-medium ${
                            submission.status === 'graded' ? 'text-green-600 dark:text-green-400' :
                            submission.status === 'submitted' ? 'text-blue-600 dark:text-blue-400' :
                            'text-yellow-600 dark:text-yellow-400'
                          }`}>{submission.status}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No submissions yet.</p>
                )}
              </div>

              <div>
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Discussions</h4>
                {groupActivity.discussions.length > 0 ? (
                  <div className="space-y-2">
                    {groupActivity.discussions.map(discussion => (
                      <div key={discussion._id} className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-600 dark:bg-gray-800/60">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{discussion.title}</p>
                        <p className="mb-1 text-sm text-gray-600 dark:text-gray-400">{discussion.content}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          By {discussion.author.firstName} {discussion.author.lastName} on{' '}
                          {new Date(discussion.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No discussions yet.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end border-t border-gray-200 bg-gray-50/90 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
              <button
                onClick={() => {
                  setShowActivityModal(false);
                  setGroupActivity(null);
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteGroupConfirm}
        onClose={() => {
          setShowDeleteGroupConfirm(false);
          setGroupToDelete(null);
        }}
        onConfirm={confirmDeleteGroup}
        title="Delete Group"
        message="Are you sure you want to delete this group?"
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default GroupManagement; 