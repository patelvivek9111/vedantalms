import React, { useState, useEffect } from 'react';
import { updateOverviewConfig } from '../services/api';
import { Settings, X, Save, Eye, MessageSquare, Sparkles } from 'lucide-react';

interface OverviewConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  currentConfig: {
    showLatestAnnouncements: boolean;
    numberOfAnnouncements: number;
  };
  onConfigUpdated: (config: any) => void;
}

const OverviewConfigModal: React.FC<OverviewConfigModalProps> = ({
  isOpen,
  onClose,
  courseId,
  currentConfig,
  onConfigUpdated
}) => {
  const [config, setConfig] = useState({
    showLatestAnnouncements: false,
    numberOfAnnouncements: 3
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentConfig) {
      setConfig(currentConfig);
    }
  }, [currentConfig]);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await updateOverviewConfig(courseId, config);
      if (response.success) {
        onConfigUpdated(response.data);
        onClose();
      } else {
        setError(response.message || 'Failed to update configuration');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update configuration');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4 border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Overview Configuration
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Customize what students see on the overview page
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                {error}
              </div>
            </div>
          )}

          {/* Student View Configuration */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                <Eye className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Student Overview Settings
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Control what information students see on their overview page
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              {/* Show Latest Announcements Toggle */}
              <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <label className="text-base font-semibold text-gray-900 dark:text-white">
                        Show Latest Announcements
                      </label>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Display recent announcements on student overview page for quick access
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showLatestAnnouncements}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        showLatestAnnouncements: e.target.checked
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-gradient-to-r peer-checked:from-green-500 peer-checked:to-green-600"></div>
                  </label>
                </div>
              </div>

              {/* Number of Announcements */}
              {config.showLatestAnnouncements && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <label className="block text-base font-semibold text-gray-900 dark:text-white">
                        Number of Announcements to Show
                      </label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Choose how many recent announcements students will see
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map(num => (
                      <button
                        key={num}
                        onClick={() => setConfig(prev => ({
                          ...prev,
                          numberOfAnnouncements: num
                        }))}
                        className={`p-3 rounded-lg border-2 transition-all duration-200 font-semibold text-sm ${
                          config.numberOfAnnouncements === num
                            ? 'border-blue-500 bg-blue-500 text-white shadow-lg'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-600'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                      <Sparkles className="w-4 h-4" />
                      <span>
                        Students will see the <strong>{config.numberOfAnnouncements}</strong> most recent announcements on their overview page
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center gap-2 shadow-lg"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default OverviewConfigModal; 