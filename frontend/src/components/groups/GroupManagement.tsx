import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { Plus, Users, Trash2, Edit2, UserPlus, Shuffle, MessageSquare, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

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
  const [groupSets, setGroupSets] = useState<GroupSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<GroupSet | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<User[]>([]);
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupStructure, setGroupStructure] = useState('manual');
  const [groupCount, setGroupCount] = useState(2);
  const [studentsPerGroup, setStudentsPerGroup] = useState(2);

  const navigate = useNavigate();

  // Fetch group sets and students
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const [setsRes, studentsRes] = await Promise.all([
          api.get(`/groups/sets/${courseId}`),
          api.get(`/courses/${courseId}/students`)
        ]);
        setGroupSets(setsRes.data);
        setStudents(studentsRes.data);
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
        const token = localStorage.getItem('token');
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
      const token = localStorage.getItem('token');
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
        `${API_URL}/api/groups/sets`,
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
      const token = localStorage.getItem('token');
      const response = await api.post(
        `${API_URL}/api/groups/sets/${selectedSet._id}/groups`,
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
      console.error("Error creating group:", err.response?.data || err.message);
      setError(err.response?.data?.message || err.response?.data?.error || 'Error creating group');
    }
  };

  const handleAutoSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSet) return;
    try {
      const token = localStorage.getItem('token');
      const response = await api.post(
        `${API_URL}/api/groups/sets/${selectedSet._id}/auto-split`,
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

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;
    try {
      const token = localStorage.getItem('token');
      await api.delete(`/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(groups.filter(g => g._id !== groupId));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error deleting group');
    }
  };

  const handleEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    try {
      const token = localStorage.getItem('token');
      const response = await api.put(
        `${API_URL}/api/groups/${selectedGroup._id}`,
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
      const token = localStorage.getItem('token');
      await api.post(
        `${API_URL}/api/groups/${selectedGroup._id}/message`,
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
      const token = localStorage.getItem('token');
      const response = await api.get(
        `${API_URL}/api/groups/${groupId}/activity`,
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
          const token = localStorage.getItem('token');
          // Update source group if student was in a group
          if (sourceGroup && sourceGroup._id !== destGroupId) {
            const newSourceMembers = updatedGroups.find(g => g._id === sourceGroup._id)?.members.map(m => m._id) || [];
            await api.put(
              `${API_URL}/api/groups/${sourceGroup._id}`,
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
            `${API_URL}/api/groups/${destGroupId}`,
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
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Group Management</h2>
        <button
          onClick={() => setShowCreateSetModal(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
          Create Group Set
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base">
          {error}
        </div>
      )}

      {/* Group Sets List */}
      <div className="mb-6 sm:mb-8">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">Group Sets</h3>
        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupSets.map(set => (
            <div
              key={set._id}
              className={`p-3 sm:p-4 border rounded-lg cursor-pointer ${
                selectedSet?._id === set._id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
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
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
            {/* Sidebar: Student List (only for manual group sets) */}
            {selectedSet.groupStructure === 'manual' && (
              <div className="w-full lg:w-64 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 h-fit">
                <h4 className="font-medium text-gray-900 mb-2">Students</h4>
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
                              className="p-2 bg-white border rounded flex items-center gap-2 shadow-sm cursor-move"
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Groups in {selectedSet.name}</h3>
                {selectedSet.groupStructure === 'manual' && (
                  <button
                    onClick={() => setShowCreateGroupModal(true)}
                    className="inline-flex items-center px-3 py-1 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
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
                        className="p-4 border border-gray-200 rounded-lg min-h-[80px] cursor-pointer"
                        onClick={e => {
                          // Prevent navigation if clicking the expand/collapse button
                          if ((e.target as HTMLElement).closest('button')) return;
                          navigate(`/groups/${group._id}`);
                        }}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => toggleGroupExpand(group._id)}
                              className="text-gray-400 hover:text-gray-500"
                            >
                              {expandedGroups.has(group._id) ? (
                                <ChevronUp className="h-5 w-5" />
                              ) : (
                                <ChevronDown className="h-5 w-5" />
                              )}
                            </button>
                            <h4 className="font-medium text-gray-900">{group.name}</h4>
                          </div>
                        </div>
                        {expandedGroups.has(group._id) && (
                          <div className="space-y-2 mt-2">
                            <p className="text-sm font-medium text-gray-700">Members:</p>
                            <ul className="text-sm text-gray-600">
                              {group.members.map((member, idx) => (
                                <Draggable key={member._id} draggableId={member._id} index={idx}>
                                  {(provided) => (
                                    <li
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      className="flex items-center p-2 bg-white border rounded mb-1 gap-2 shadow-sm"
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

      {/* Create Group Set Modal */}
      {showCreateSetModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create Group Set</h3>
            <form onSubmit={handleCreateSet}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  id="new-set-name"
                  name="newSetName"
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    id="allow-self-signup"
                    name="allowSelfSignup"
                    checked={allowSelfSignup}
                    onChange={(e) => setAllowSelfSignup(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Allow self-signup</span>
                </label>
              </div>
              <div className="mb-4">
                <label htmlFor="groupStructure" className="block text-sm font-medium text-gray-700">Group Structure</label>
                <select
                  id="groupStructure"
                  name="groupStructure"
                  value={groupStructure}
                  onChange={e => setGroupStructure(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="manual">Create groups later</option>
                  <option value="byGroupCount">Split students by number of groups</option>
                  <option value="byStudentsPerGroup">Split number of students per group</option>
                </select>
              </div>
              {groupStructure === 'byGroupCount' && (
                <div className="mb-4">
                  <label htmlFor="groupCount" className="block text-sm font-medium text-gray-700">Number of Groups</label>
                  <input
                    id="groupCount"
                    name="groupCount"
                    type="number"
                    min={2}
                    value={groupCount}
                    onChange={e => setGroupCount(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              )}
              {groupStructure === 'byStudentsPerGroup' && (
                <div className="mb-4">
                  <label htmlFor="studentsPerGroup" className="block text-sm font-medium text-gray-700">
                    Number of Students per Group
                  </label>
                  <input
                    id="studentsPerGroup"
                    name="studentsPerGroup"
                    type="number"
                    min={2}
                    value={studentsPerGroup}
                    onChange={e => setStudentsPerGroup(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter the number of students you want in each group. Minimum is 2.
                  </p>
                </div>
              )}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateSetModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
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
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create Group</h3>
            <form onSubmit={handleCreateGroup}>
              <div className="mb-4">
                <label htmlFor="groupName" className="block text-sm font-medium text-gray-700">Group Name</label>
                <input
                  id="groupName"
                  name="groupName"
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              {/* Only show member selection for non-manual group sets */}
              {selectedSet.groupStructure !== 'manual' && (
                <div className="mb-4">
                  <label htmlFor="groupMembers" className="block text-sm font-medium text-gray-700">Select Members</label>
                  <select
                    id="groupMembers"
                    name="groupMembers"
                    multiple
                    value={selectedStudents}
                    onChange={(e) => setSelectedStudents(
                      Array.from(e.target.selectedOptions, option => option.value)
                    )}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    size={5}
                  >
                    {students.map(student => (
                      <option key={student._id} value={student._id}>
                        {student.firstName} {student.lastName}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-sm text-gray-500">
                    Hold Ctrl/Cmd to select multiple students
                  </p>
                </div>
              )}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
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
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Auto-split Students</h3>
            <form onSubmit={handleAutoSplit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Group Size</label>
                <input
                  type="number"
                  id="auto-split-group-size"
                  name="groupSize"
                  min="2"
                  max={students.length}
                  value={groupSize}
                  onChange={(e) => setGroupSize(parseInt(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  Students will be randomly assigned to groups of this size
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAutoSplitModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
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
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Group</h3>
            <form onSubmit={handleEditGroup}>
              <div className="mb-4">
                <label htmlFor="editGroupName" className="block text-sm font-medium text-gray-700">Group Name</label>
                <input
                  id="editGroupName"
                  name="editGroupName"
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="editGroupMembers" className="block text-sm font-medium text-gray-700">Select Members</label>
                <select
                  id="editGroupMembers"
                  name="editGroupMembers"
                  multiple
                  value={selectedStudents}
                  onChange={(e) => setSelectedStudents(
                    Array.from(e.target.selectedOptions, option => option.value)
                  )}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  size={5}
                >
                  {students.map(student => (
                    <option key={student._id} value={student._id}>
                      {student.firstName} {student.lastName}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  First selected student will be the group leader
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditGroupModal(false);
                    setSelectedGroup(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Message Group Modal */}
      {showMessageModal && selectedGroup && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Message Group: {selectedGroup.name}</h3>
            <form onSubmit={handleSendMessage}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Subject</label>
                <input
                  type="text"
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Message</label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowMessageModal(false);
                    setSelectedGroup(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                >
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Activity Modal */}
      {showActivityModal && groupActivity && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 max-w-2xl w-full max-h-[95vh] sm:max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Group Activity</h3>
            
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-900 mb-2">Submissions</h4>
              {groupActivity.submissions.length > 0 ? (
                <div className="space-y-2">
                  {groupActivity.submissions.map(submission => (
                    <div key={submission._id} className="p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium">{submission.assignment.title}</p>
                      <p className="text-sm text-gray-600">
                        Submitted: {new Date(submission.submittedAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Status: <span className={`font-medium ${
                          submission.status === 'graded' ? 'text-green-600' :
                          submission.status === 'submitted' ? 'text-blue-600' :
                          'text-yellow-600'
                        }`}>{submission.status}</span>
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No submissions yet</p>
              )}
            </div>

            <div>
              <h4 className="text-md font-medium text-gray-900 mb-2">Discussions</h4>
              {groupActivity.discussions.length > 0 ? (
                <div className="space-y-2">
                  {groupActivity.discussions.map(discussion => (
                    <div key={discussion._id} className="p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium">{discussion.title}</p>
                      <p className="text-sm text-gray-600 mb-1">{discussion.content}</p>
                      <p className="text-xs text-gray-500">
                        By {discussion.author.firstName} {discussion.author.lastName} on{' '}
                        {new Date(discussion.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No discussions yet</p>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowActivityModal(false);
                  setGroupActivity(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupManagement; 