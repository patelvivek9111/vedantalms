import { useState } from 'react';
import { getMemoryAuthToken, authFetchInit } from '../utils/authToken';
import api from '../services/api';
import type { NormalizedFile } from '../utils/fileTypes';
import { mapUploadResponse } from '../utils/fileTypes';

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
  const [syllabusAttachmentFiles, setSyllabusAttachmentFiles] = useState<NormalizedFile[]>([]);
  const [removeSyllabusAssetIds, setRemoveSyllabusAssetIds] = useState<string[]>([]);

  const handleSyllabusFieldChange = (field: string, value: string) => {
    setSyllabusFields(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSyllabusFields = async () => {
    if (!course?._id) return;
    setSavingSyllabus(true);
    try {
      const token = getMemoryAuthToken();
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

  const loadSyllabusFilesFromCourse = (
    catalogFiles: Array<{ name?: string; url?: string; size?: number; fileAssetId?: string }>
  ) => {
    setSyllabusAttachmentFiles(
      (catalogFiles || []).map((f, i) =>
        mapUploadResponse({
          path: f.url,
          originalname: f.name || `file-${i + 1}`,
          size: f.size,
          fileAssetId: f.fileAssetId,
        })
      )
    );
  };

  const handleSaveSyllabus = async () => {
    if (!course?._id) return;
    setSavingSyllabus(true);
    try {
      const token = getMemoryAuthToken();
      const fileAssetIds = syllabusAttachmentFiles.map((f) => f.fileAssetId).filter(Boolean);
      const response = await api.put(`/courses/${course._id}`, {
        catalog: {
          ...course.catalog,
          syllabusContent: syllabusContent,
          syllabusFileAssetIds: fileAssetIds,
          removeSyllabusFileAssetIds: removeSyllabusAssetIds,
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setCourse(response.data.data);
        setSyllabusMode('none');
        setSyllabusContent('');
        setSyllabusAttachmentFiles([]);
        setRemoveSyllabusAssetIds([]);
      }
    } catch (err: any) {
      alert('Failed to save syllabus');
    } finally {
      setSavingSyllabus(false);
    }
  };

  const enterSyllabusUploadMode = () => {
    loadSyllabusFilesFromCourse(course.catalog?.syllabusFiles || []);
    setRemoveSyllabusAssetIds([]);
    setSyllabusMode('upload');
  };

  const enterSyllabusEditorMode = () => {
    loadSyllabusFilesFromCourse(course.catalog?.syllabusFiles || []);
    setSyllabusContent(course.catalog?.syllabusContent || '');
    setRemoveSyllabusAssetIds([]);
    setSyllabusMode('editor');
  };

  const handleDeletePublishedSyllabusFile = async (file: NormalizedFile) => {
    if (!course?._id || !file.fileAssetId) return;
    if (!window.confirm(`Remove "${file.name}" from the syllabus?`)) return;
    setSavingSyllabus(true);
    try {
      const token = getMemoryAuthToken();
      const response = await api.put(
        `/courses/${course._id}`,
        {
          catalog: {
            ...course.catalog,
            removeSyllabusFileAssetIds: [file.fileAssetId],
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setCourse(response.data.data);
        if (syllabusMode !== 'none') {
          loadSyllabusFilesFromCourse(response.data.data.catalog?.syllabusFiles || []);
        }
      }
    } catch {
      alert('Failed to remove syllabus file');
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
    syllabusAttachmentFiles,
    setSyllabusAttachmentFiles,
    loadSyllabusFilesFromCourse,
    handleSyllabusFieldChange,
    handleSaveSyllabusFields,
    handleSaveSyllabus,
    enterSyllabusUploadMode,
    enterSyllabusEditorMode,
    handleDeletePublishedSyllabusFile,
    removeSyllabusAssetIds,
    onRemoveSyllabusFile: (file: NormalizedFile) => {
      if (file.fileAssetId) setRemoveSyllabusAssetIds((prev) => [...prev, file.fileAssetId!]);
    },
  };
};





