import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface UseAssignmentGroupsManagementProps {
  course: any;
  setCourse: React.Dispatch<React.SetStateAction<any>>;
  setGradeScaleError?: React.Dispatch<React.SetStateAction<string>>;
}

export const useAssignmentGroupsManagement = ({
  course,
  setCourse,
  setGradeScaleError,
}: UseAssignmentGroupsManagementProps) => {
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editGroups, setEditGroups] = useState<any[]>([]);
  const [groupError, setGroupError] = useState('');
  const [savingGroups, setSavingGroups] = useState(false);

  const handleOpenGroupModal = () => {
    setEditGroups(course?.groups ? [...course.groups] : []);
    setShowGroupModal(true);
    setGroupError('');
    if (setGradeScaleError) setGradeScaleError(''); // Clear any grade scale errors
  };

  const handleGroupChange = (idx: number, field: string, value: string | number) => {
    setEditGroups(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const handleAddGroupRow = () => {
    setEditGroups(prev => [...prev, { name: '', weight: 0 }]);
  };

  const handleRemoveGroupRow = (idx: number) => {
    setEditGroups(prev => prev.filter((_, i) => i !== idx));
  };

  const handleResetToDefaults = () => {
    const defaultGroups = [
      { name: 'Projects', weight: 15 },
      { name: 'Homework', weight: 15 },
      { name: 'Exams', weight: 20 },
      { name: 'Quizzes', weight: 30 },
      { name: 'Participation', weight: 20 }
    ];
    setEditGroups(defaultGroups);
    setGroupError('');
  };

  const handleSaveGroups = async () => {
    setSavingGroups(true);
    setGroupError('');
    try {
      // Validate
      let total = 0;
      for (const row of editGroups) {
        if (!row.name || row.weight === '' || isNaN(row.weight)) {
          setGroupError('All fields are required and must be valid numbers.');
          setSavingGroups(false);
          return;
        }
        total += Number(row.weight);
      }
      if (total !== 100) {
        setGroupError('Total weight must be 100%.');
        setSavingGroups(false);
        return;
      }
      // Save to backend
      const token = localStorage.getItem('token');
      const baseUrl = API_URL || '';
      const res = await axios.put(
        `${baseUrl}/api/courses/${course._id}`,
        {
          ...course,
          groups: editGroups
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setCourse(res.data.data);
        setShowGroupModal(false);
      } else {
        setGroupError('Failed to save assignment groups.');
      }
    } catch (err: any) {
      setGroupError(err.response?.data?.message || 'Error saving assignment groups');
    } finally {
      setSavingGroups(false);
    }
  };

  return {
    showGroupModal,
    setShowGroupModal,
    editGroups,
    setEditGroups,
    groupError,
    setGroupError,
    savingGroups,
    handleOpenGroupModal,
    handleGroupChange,
    handleAddGroupRow,
    handleRemoveGroupRow,
    handleResetToDefaults,
    handleSaveGroups,
  };
};

