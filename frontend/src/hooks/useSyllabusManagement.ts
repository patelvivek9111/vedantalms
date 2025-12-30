import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { API_URL } from '../config';
import axios from 'axios';
import logger from '../utils/logger';

interface UseSyllabusManagementProps {
  course: any;
  setCourse: (course: any) => void;
  isInstructor: boolean;
  isAdmin: boolean;
}

export const useSyllabusManagement = ({
  course,
  setCourse,
  isInstructor,
  isAdmin,
}: UseSyllabusManagementProps) => {
  const [editingSyllabus, setEditingSyllabus] = useState(false);
  const [syllabusFields, setSyllabusFields] = useState({
    courseTitle: '',
    courseCode: '',
    instructorName: '',
    instructorEmail: '',
    officeHours: 'By Appointment'
  });
  const [savingSyllabus, setSavingSyllabus] = useState(false);
  const [syllabusMode, setSyllabusMode] = useState<'none' | 'upload' | 'editor'>('none');
  const [syllabusContent, setSyllabusContent] = useState('');
  const [syllabusFiles, setSyllabusFiles] = useState<File[]>([]);
  const [uploadedSyllabusFiles, setUploadedSyllabusFiles] = useState<any[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Load syllabus data when course is loaded
  useEffect(() => {
    if (course) {
      setSyllabusFields({
        courseTitle: course.title || '',
        courseCode: course.catalog?.courseCode || '',
        instructorName: `${course.instructor?.firstName || ''} ${course.instructor?.lastName || ''}`.trim(),
        instructorEmail: course.instructor?.email || '',
        officeHours: course.catalog?.officeHours || 'By Appointment'
      });
      setSyllabusContent(course.catalog?.syllabusContent || '');
      setUploadedSyllabusFiles(course.catalog?.syllabusFiles || []);
    }
  }, [course]);

  const handleSyllabusFieldChange = useCallback((field: string, value: string) => {
    setSyllabusFields(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSaveSyllabusFields = useCallback(async () => {
    if (!course?._id) return;
    setSavingSyllabus(true);
    try {
      const token = localStorage.getItem('token');
      const response = await api.put(`/courses/${course._id}`, {
        title: syllabusFields.courseTitle,
        catalog: {
          ...course.catalog,
          courseCode: syllabusFields.courseCode,
          officeHours: syllabusFields.officeHours
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setCourse(response.data.data);
        setEditingSyllabus(false);
      }
    } catch (err: any) {
      logger.error('Error saving syllabus fields', err);
      throw err;
    } finally {
      setSavingSyllabus(false);
    }
  }, [course, syllabusFields, setCourse]);

  const handleSyllabusFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploadingFiles(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const newFiles = response.data.files.map((file: any) => ({
        name: file.originalname,
        url: file.path,
        size: file.size,
        uploadedAt: new Date()
      }));

      setUploadedSyllabusFiles(prev => [...prev, ...newFiles]);
      setSyllabusFiles(prev => [...prev, ...files]);
    } catch (error: any) {
      logger.error('Error uploading files', error);
      throw error;
    } finally {
      setUploadingFiles(false);
    }
  }, []);

  const handleRemoveSyllabusFile = useCallback((index: number) => {
    setUploadedSyllabusFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSaveSyllabus = useCallback(async () => {
    if (!course?._id) return;
    setSavingSyllabus(true);
    try {
      const token = localStorage.getItem('token');
      const response = await api.put(`/courses/${course._id}`, {
        catalog: {
          ...course.catalog,
          syllabusContent: syllabusContent,
          syllabusFiles: uploadedSyllabusFiles
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setCourse(response.data.data);
        setSyllabusMode('none');
        setSyllabusContent('');
        setSyllabusFiles([]);
      }
    } catch (err: any) {
      logger.error('Error saving syllabus', err);
      throw err;
    } finally {
      setSavingSyllabus(false);
    }
  }, [course, syllabusContent, uploadedSyllabusFiles, setCourse]);

  const resetSyllabusFields = useCallback(() => {
    if (course) {
      setSyllabusFields({
        courseTitle: course.title || '',
        courseCode: course.catalog?.courseCode || '',
        instructorName: `${course.instructor?.firstName || ''} ${course.instructor?.lastName || ''}`.trim(),
        instructorEmail: course.instructor?.email || '',
        officeHours: course.catalog?.officeHours || 'By Appointment'
      });
    }
  }, [course]);

  const cancelSyllabusEdit = useCallback(() => {
    setEditingSyllabus(false);
    resetSyllabusFields();
  }, [resetSyllabusFields]);

  const cancelSyllabusMode = useCallback(() => {
    setSyllabusMode('none');
    setSyllabusContent(course?.catalog?.syllabusContent || '');
    setUploadedSyllabusFiles(course?.catalog?.syllabusFiles || []);
  }, [course]);

  return {
    editingSyllabus,
    setEditingSyllabus,
    syllabusFields,
    handleSyllabusFieldChange,
    handleSaveSyllabusFields,
    savingSyllabus,
    syllabusMode,
    setSyllabusMode,
    syllabusContent,
    setSyllabusContent,
    syllabusFiles,
    uploadedSyllabusFiles,
    uploadingFiles,
    handleSyllabusFileUpload,
    handleRemoveSyllabusFile,
    handleSaveSyllabus,
    resetSyllabusFields,
    cancelSyllabusEdit,
    cancelSyllabusMode,
  };
};

