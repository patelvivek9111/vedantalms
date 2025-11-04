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
    if (!courseId) return;
    
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
    setLoading(true); 
    setError(null);
    try {
      const res = await api.post('/modules', { 
        title: data.title, 
        course: courseId, 
        description: data.description 
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
    setLoading(true);
    setError(null);
    try {
      await api.put(`/modules/${moduleId}`, data);
      await getModulesRef.current(courseId);
    } catch (err: any) {
      console.error('Error updating module:', err);
      setError(err.response?.data?.message || 'Error updating module');
    } finally {
      setLoading(false);
    }
  };

  const createPage = async (data: { title: string; content: string; module?: string; groupSet?: string }, attachments?: File[]) => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (attachments && attachments.length > 0) {
        const form = new FormData();
        form.append('title', data.title);
        form.append('content', data.content);
        if (data.module) form.append('module', data.module);
        if (data.groupSet) form.append('groupSet', data.groupSet);
        attachments.forEach(file => form.append('attachments', file));
        res = await api.post('/pages', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        const payload: any = { title: data.title, content: data.content };
        if (data.module) payload.module = data.module;
        if (data.groupSet) payload.groupSet = data.groupSet;
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
    if (!moduleId) return [];
    
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
    try {
      const res = await api.get(`/pages/view/${pageId}`);
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
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/modules/${moduleId}`);
      await getModulesRef.current(courseId);
    } catch (err: any) {
      console.error('Error deleting module:', err);
      setError(err.response?.data?.message || 'Error deleting module');
    } finally {
      setLoading(false);
    }
  };

  const toggleModulePublish = async (moduleId: string) => {
    try {
      const res = await api.patch(`/modules/${moduleId}/publish`);
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