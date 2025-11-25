import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export interface Page {
  _id: string;
  title: string;
  module: string;
  content: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Module {
  _id: string;
  title: string;
  course: string;
  description: string;
  pages: Page[];
  createdAt: string;
  updatedAt: string;
}

interface ModuleContextType {
  modules: Module[];
  loading: boolean;
  error: string | null;
  getModules: (courseId: string) => Promise<void>;
  createModule: (courseId: string, data: { title: string; description: string }) => Promise<void>;
  updateModule: (moduleId: string, data: { title: string; description: string }, courseId: string) => Promise<void>;
  createPage: (data: { title: string; content: string; module?: string; groupSet?: string }, attachments?: File[]) => Promise<void>;
  getPages: (moduleId: string) => Promise<Page[]>;
  getPage: (pageId: string) => Promise<Page>;
  deleteModule: (moduleId: string, courseId: string) => Promise<void>;
  toggleModulePublish: (moduleId: string) => Promise<void>;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export const ModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const getModules = useCallback(async (courseId: string) => {
    // Validate courseId
    if (!courseId || typeof courseId !== 'string' || courseId.trim() === '' || courseId === 'undefined' || courseId === 'null') {
      console.warn('Invalid courseId in getModules');
      return;
    }

    // Validate ObjectId format
    if (!/^[a-fA-F0-9]{24}$/.test(courseId.trim())) {
      console.warn('Invalid courseId format in getModules');
      return;
    }
    
    setLoading(true); 
    setError(null);
    try {
      const res = await api.get(`/modules/${courseId}`);
      if (res.data.success) {
        setModules(res.data.data);
      } else {
        setError(res.data.message || 'Failed to fetch modules');
      }
    } catch (err: any) {
      console.error('Error fetching modules:', err);
      setError(err.response?.data?.message || 'Error fetching modules');
    } finally {
      setLoading(false);
    }
  }, []);

  const getModulesRef = useRef(getModules);

  useEffect(() => {
    getModulesRef.current = getModules;
  }, [getModules]);

  const createModule = async (courseId: string, data: { title: string; description: string }) => {
    // Validate courseId
    if (!courseId || typeof courseId !== 'string' || courseId.trim() === '' || courseId === 'undefined' || courseId === 'null') {
      throw new Error('Invalid course ID');
    }

    if (!/^[a-fA-F0-9]{24}$/.test(courseId.trim())) {
      throw new Error('Invalid course ID format');
    }

    // Validate data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid module data');
    }

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new Error('Module title is required');
    }

    if (data.title.trim().length > 200) {
      throw new Error('Module title must be 200 characters or less');
    }

    setLoading(true); 
    setError(null);
    try {
      const res = await api.post('/modules', { 
        title: data.title.trim(), 
        course: courseId.trim(), 
        description: data.description ? data.description.trim() : data.description
      });
      if (res.data.success) {
        await getModulesRef.current(courseId);
      } else {
        setError(res.data.message || 'Failed to create module');
      }
    } catch (err: any) {
      console.error('Error creating module:', err);
      setError(err.response?.data?.message || 'Error creating module');
    } finally {
      setLoading(false);
    }
  };

  const updateModule = async (moduleId: string, data: { title: string; description: string }, courseId: string) => {
    // Validate IDs
    if (!moduleId || typeof moduleId !== 'string' || moduleId.trim() === '' || moduleId === 'undefined' || moduleId === 'null') {
      throw new Error('Invalid module ID');
    }

    if (!courseId || typeof courseId !== 'string' || courseId.trim() === '' || courseId === 'undefined' || courseId === 'null') {
      throw new Error('Invalid course ID');
    }

    if (!/^[a-fA-F0-9]{24}$/.test(moduleId.trim())) {
      throw new Error('Invalid module ID format');
    }

    if (!/^[a-fA-F0-9]{24}$/.test(courseId.trim())) {
      throw new Error('Invalid course ID format');
    }

    // Validate data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid module data');
    }

    if (data.title !== undefined) {
      if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
        throw new Error('Module title cannot be empty');
      }
      if (data.title.trim().length > 200) {
        throw new Error('Module title must be 200 characters or less');
      }
    }

    setLoading(true);
    setError(null);
    try {
      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title.trim();
      if (data.description !== undefined) updateData.description = data.description ? data.description.trim() : data.description;
      await api.put(`/modules/${moduleId.trim()}`, updateData);
      await getModulesRef.current(courseId);
    } catch (err: any) {
      console.error('Error updating module:', err);
      setError(err.response?.data?.message || 'Error updating module');
    } finally {
      setLoading(false);
    }
  };

  const createPage = async (data: { title: string; content: string; module?: string; groupSet?: string }, attachments?: File[]) => {
    // Validate data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid page data');
    }

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new Error('Page title is required');
    }

    if (!data.content || typeof data.content !== 'string' || data.content.trim().length === 0) {
      throw new Error('Page content is required');
    }

    if (data.title.trim().length > 200) {
      throw new Error('Page title must be 200 characters or less');
    }

    // Validate module if provided
    if (data.module !== undefined && data.module !== null) {
      if (typeof data.module !== 'string' || data.module.trim() === '' || !/^[a-fA-F0-9]{24}$/.test(data.module.trim())) {
        throw new Error('Invalid module ID format');
      }
    }

    // Validate groupSet if provided
    if (data.groupSet !== undefined && data.groupSet !== null) {
      if (typeof data.groupSet !== 'string' || data.groupSet.trim() === '' || !/^[a-fA-F0-9]{24}$/.test(data.groupSet.trim())) {
        throw new Error('Invalid group set ID format');
      }
    }

    // Validate attachments if provided
    if (attachments !== undefined && attachments !== null) {
      if (!Array.isArray(attachments)) {
        throw new Error('Attachments must be an array');
      }
      // Limit number of attachments
      if (attachments.length > 10) {
        throw new Error('Maximum 10 attachments allowed');
      }
    }

    setLoading(true);
    setError(null);
    try {
      let res;
      if (attachments && attachments.length > 0) {
        const form = new FormData();
        form.append('title', data.title.trim());
        form.append('content', data.content.trim());
        if (data.module) form.append('module', data.module.trim());
        if (data.groupSet) form.append('groupSet', data.groupSet.trim());
        attachments.forEach(file => form.append('attachments', file));
        res = await api.post('/pages', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        const payload: any = { title: data.title.trim(), content: data.content.trim() };
        if (data.module) payload.module = data.module.trim();
        if (data.groupSet) payload.groupSet = data.groupSet.trim();
        res = await api.post('/pages', payload);
      }
      if (res.data.success && data.module) {
        const currentModule = modules.find(m => m._id === data.module);
        if (currentModule) {
          await getModulesRef.current(currentModule.course);
        }
      }
      if (!res.data.success) {
        setError(res.data.message || 'Failed to create page');
      }
    } catch (err: any) {
      console.error('Error creating page:', err);
      setError(err.response?.data?.message || 'Error creating page');
    } finally {
      setLoading(false);
    }
  };

  const getPages = useCallback(async (moduleId: string): Promise<Page[]> => {
    // Validate moduleId
    if (!moduleId || typeof moduleId !== 'string' || moduleId.trim() === '' || moduleId === 'undefined' || moduleId === 'null') {
      console.warn('Invalid moduleId in getPages');
      return [];
    }

    if (!/^[a-fA-F0-9]{24}$/.test(moduleId.trim())) {
      console.warn('Invalid moduleId format in getPages');
      return [];
    }
    
    try {
      const res = await api.get(`/pages/${moduleId}`);
      if (res.data.success) {
        return res.data.data;
      } else {
        console.error('Failed to fetch pages:', res.data.message);
        return [];
      }
    } catch (err: any) {
      console.error('Error fetching pages:', err);
      return [];
    }
  }, []);

  const getPagesRef = useRef(getPages);

  useEffect(() => {
    getPagesRef.current = getPages;
  }, [getPages]);

  const getPage = async (pageId: string): Promise<Page> => {
    // Validate pageId
    if (!pageId || typeof pageId !== 'string' || pageId.trim() === '' || pageId === 'undefined' || pageId === 'null') {
      throw new Error('Invalid page ID');
    }

    if (!/^[a-fA-F0-9]{24}$/.test(pageId.trim())) {
      throw new Error('Invalid page ID format');
    }

    try {
      const res = await api.get(`/pages/view/${pageId.trim()}`);
      if (res.data.success) {
        return res.data.data;
      } else {
        throw new Error(res.data.message || 'Failed to fetch page');
      }
    } catch (err: any) {
      console.error('Error fetching page:', err);
      throw err;
    }
  };

  const deleteModule = async (moduleId: string, courseId: string) => {
    // Validate IDs
    if (!moduleId || typeof moduleId !== 'string' || moduleId.trim() === '' || moduleId === 'undefined' || moduleId === 'null') {
      throw new Error('Invalid module ID');
    }

    if (!courseId || typeof courseId !== 'string' || courseId.trim() === '' || courseId === 'undefined' || courseId === 'null') {
      throw new Error('Invalid course ID');
    }

    if (!/^[a-fA-F0-9]{24}$/.test(moduleId.trim())) {
      throw new Error('Invalid module ID format');
    }

    if (!/^[a-fA-F0-9]{24}$/.test(courseId.trim())) {
      throw new Error('Invalid course ID format');
    }

    setLoading(true);
    setError(null);
    try {
      await api.delete(`/modules/${moduleId.trim()}`);
      await getModulesRef.current(courseId);
    } catch (err: any) {
      console.error('Error deleting module:', err);
      setError(err.response?.data?.message || 'Error deleting module');
    } finally {
      setLoading(false);
    }
  };

  const toggleModulePublish = async (moduleId: string) => {
    // Validate moduleId
    if (!moduleId || typeof moduleId !== 'string' || moduleId.trim() === '' || moduleId === 'undefined' || moduleId === 'null') {
      throw new Error('Invalid module ID');
    }

    if (!/^[a-fA-F0-9]{24}$/.test(moduleId.trim())) {
      throw new Error('Invalid module ID format');
    }

    try {
      const res = await api.patch(`/modules/${moduleId.trim()}/publish`);
      if (res.data.success) {
        setModules(prevModules =>
          prevModules.map(m =>
            m._id === moduleId ? { ...m, published: res.data.published } : m
          )
        );
      }
    } catch (err: any) {
      console.error('Error toggling module publish status:', err);
      setError(err.response?.data?.message || 'Error toggling module publish status');
    }
  };

  return (
    <ModuleContext.Provider value={{ 
      modules, 
      loading, 
      error, 
      getModules: getModulesRef.current, 
      createModule, 
      updateModule,
      createPage, 
      getPages: getPagesRef.current, 
      getPage,
      deleteModule,
      toggleModulePublish
    }}>
      {children}
    </ModuleContext.Provider>
  );
};

export const useModule = () => {
  const context = useContext(ModuleContext);
  if (context === undefined) {
    throw new Error('useModule must be used within a ModuleProvider');
  }
  return context;
}; 