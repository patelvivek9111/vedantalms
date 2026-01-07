import { useState } from 'react';
import axios from 'axios';
import api from '../services/api';
import { API_URL } from '../config';

interface UseSyllabusManagementProps {
  course: any;
  setCourse: React.Dispatch<React.SetStateAction<any>>;
}

export const useSyllabusManagement = ({
  course,
  setCourse,
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

  const handleSyllabusFieldChange = (field: string, value: string) => {
    setSyllabusFields(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSyllabusFields = async () => {
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
      alert('Failed to save syllabus fields');
    } finally {
      setSavingSyllabus(false);
    }
  };

  const handleSyllabusFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

      const newFiles = Array.isArray(response.data?.files)
        ? response.data.files.map((file: any) => ({
            name: file.originalname,
            url: file.path,
            size: file.size,
            uploadedAt: new Date()
          }))
        : [];

      setUploadedSyllabusFiles(prev => [...prev, ...newFiles]);
      setSyllabusFiles(prev => [...prev, ...files]);
    } catch (error: any) {
      alert('Error uploading files. Please try again.');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleRemoveSyllabusFile = (index: number) => {
    setUploadedSyllabusFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveSyllabus = async () => {
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
      alert('Failed to save syllabus');
    } finally {
      setSavingSyllabus(false);
    }
  };

  return {
    editingSyllabus,
    setEditingSyllabus,
    syllabusFields,
    setSyllabusFields,
    savingSyllabus,
    syllabusMode,
    setSyllabusMode,
    syllabusContent,
    setSyllabusContent,
    uploadedSyllabusFiles,
    setUploadedSyllabusFiles,
    uploadingFiles,
    syllabusFiles,
    setSyllabusFiles,
    handleSyllabusFieldChange,
    handleSaveSyllabusFields,
    handleSyllabusFileUpload,
    handleRemoveSyllabusFile,
    handleSaveSyllabus,
  };
};





