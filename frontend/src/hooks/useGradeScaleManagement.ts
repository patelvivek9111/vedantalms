import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface UseGradeScaleManagementProps {
  course: any;
  setCourse: React.Dispatch<React.SetStateAction<any>>;
  setGroupError?: React.Dispatch<React.SetStateAction<string>>;
}

export const useGradeScaleManagement = ({
  course,
  setCourse,
  setGroupError,
}: UseGradeScaleManagementProps) => {
  const [showGradeScaleModal, setShowGradeScaleModal] = useState(false);
  const [editGradeScale, setEditGradeScale] = useState<any[]>([]);
  const [savingGradeScale, setSavingGradeScale] = useState(false);
  const [gradeScaleError, setGradeScaleError] = useState('');

  const handleOpenGradeScaleModal = () => {
    setEditGradeScale(course?.gradeScale ? [...course.gradeScale] : []);
    setShowGradeScaleModal(true);
    setGradeScaleError('');
    if (setGroupError) setGroupError(''); // Clear any group errors
  };

  const handleGradeScaleChange = (idx: number, field: string, value: string | number) => {
    setEditGradeScale(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const handleAddGradeScaleRow = () => {
    setEditGradeScale(prev => [...prev, { letter: '', min: 0, max: 0 }]);
  };

  const handleRemoveGradeScaleRow = (idx: number) => {
    setEditGradeScale(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveGradeScale = async () => {
    setSavingGradeScale(true);
    setGradeScaleError('');
    try {
      // Validate scale
      for (const row of editGradeScale) {
        if (!row.letter || row.min === '' || row.max === '' || isNaN(row.min) || isNaN(row.max)) {
          setGradeScaleError('All fields are required and must be valid numbers.');
          setSavingGradeScale(false);
          return;
        }
      }
      // Save to backend
      const token = localStorage.getItem('token');
      const baseUrl = API_URL || '';
      const res = await axios.put(
        `${baseUrl}/api/courses/${course._id}`,
        {
          title: course.title,
          description: course.description,
          gradeScale: editGradeScale
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setCourse(res.data.data);
        setShowGradeScaleModal(false);
      } else {
        setGradeScaleError('Failed to save grade scale.');
      }
    } catch (err: any) {
      setGradeScaleError(err.response?.data?.message || 'Error saving grade scale');
    } finally {
      setSavingGradeScale(false);
    }
  };

  return {
    showGradeScaleModal,
    setShowGradeScaleModal,
    editGradeScale,
    setEditGradeScale,
    savingGradeScale,
    gradeScaleError,
    setGradeScaleError,
    handleOpenGradeScaleModal,
    handleGradeScaleChange,
    handleAddGradeScaleRow,
    handleRemoveGradeScaleRow,
    handleSaveGradeScale,
  };
};

