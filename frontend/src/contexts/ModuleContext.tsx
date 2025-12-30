import React, { createContext, useContext, useState, ReactNode } from 'react';
import api from '../services/api';

export interface Module {
  _id: string;
  title: string;
  description?: string;
  course: string;
  pages?: string[];
  published: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ModuleContextType {
  modules: Module[];
  setModules: (modules: Module[]) => void;
  currentModule: Module | null;
  setCurrentModule: (module: Module | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  getModules: (courseId: string) => Promise<Module[]>;
  getPages: (moduleId: string) => Promise<any[]>;
  getPage: (pageId: string) => Promise<any>;
  deleteModule: (moduleId: string, courseId: string) => Promise<void>;
  toggleModulePublish: (moduleId: string) => Promise<void>;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export const ModuleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modules, setModules] = useState<Module[]>([]);
  const [currentModule, setCurrentModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const getModules = async (courseId: string): Promise<Module[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/modules/${courseId}`);
      const modulesData = response.data.data || response.data || [];
      const modulesArray = Array.isArray(modulesData) ? modulesData : [];
      setModules(modulesArray);
      return modulesArray;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch modules';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getPages = async (moduleId: string): Promise<any[]> => {
    setError(null);
    try {
      const response = await api.get(`/pages/module/${moduleId}`);
      return response.data.data || response.data || [];
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch pages';
      setError(errorMessage);
      return [];
    }
  };

  const getPage = async (pageId: string): Promise<any> => {
    setError(null);
    try {
      const response = await api.get(`/pages/view/${pageId}`);
      return response.data.data || response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch page';
      setError(errorMessage);
      throw err;
    }
  };

  const deleteModule = async (moduleId: string, courseId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/modules/${moduleId}`);
      setModules(prev => prev.filter(m => m._id !== moduleId));
      if (currentModule?._id === moduleId) {
        setCurrentModule(null);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to delete module';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const toggleModulePublish = async (moduleId: string): Promise<void> => {
    setError(null);
    try {
      const response = await api.patch(`/modules/${moduleId}/publish`);
      const updatedModule = response.data.data || response.data;
      setModules(prev => prev.map(m => m._id === moduleId ? updatedModule : m));
      if (currentModule?._id === moduleId) {
        setCurrentModule(updatedModule);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to toggle module publish';
      setError(errorMessage);
      throw err;
    }
  };

  return (
    <ModuleContext.Provider
      value={{
        modules,
        setModules,
        currentModule,
        setCurrentModule,
        loading,
        setLoading,
        error,
        getModules,
        getPages,
        getPage,
        deleteModule,
        toggleModulePublish,
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
};

export const useModule = (): ModuleContextType => {
  const context = useContext(ModuleContext);
  if (context === undefined) {
    throw new Error('useModule must be used within a ModuleProvider');
  }
  return context;
};

