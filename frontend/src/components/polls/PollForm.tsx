import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { X, Plus, Trash2, Calendar } from 'lucide-react';

interface PollFormProps {
  courseId: string;
  poll?: {
    _id: string;
    title: string;
    options: Array<{text: string, votes: number}>;
    endDate: string;
    allowMultipleVotes: boolean;
    resultsVisible: boolean;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

const PollForm: React.FC<PollFormProps> = ({ courseId, poll, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    options: ['', ''],
    endDate: '',
    allowMultipleVotes: false,
    resultsVisible: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!poll;

  useEffect(() => {
    if (poll) {
             // Format the end date properly for datetime-local input with 10-minute increments
       const pollEndDate = new Date(poll.endDate);
       // Round minutes to nearest 10-minute increment
       const minutes = Math.round(pollEndDate.getMinutes() / 10) * 10;
       pollEndDate.setMinutes(minutes);
       const year = pollEndDate.getFullYear();
       const month = String(pollEndDate.getMonth() + 1).padStart(2, '0');
       const day = String(pollEndDate.getDate()).padStart(2, '0');
       const hours = String(pollEndDate.getHours()).padStart(2, '0');
       const minutesStr = String(minutes).padStart(2, '0');
       const formattedEndDate = `${year}-${month}-${day}T${hours}:${minutesStr}`;
      
      setFormData({
        title: poll.title,
        options: poll.options.map(option => option.text),
        endDate: formattedEndDate,
        allowMultipleVotes: poll.allowMultipleVotes,
        resultsVisible: poll.resultsVisible
      });
    } else {
             // Set default end date to 7 days from now with 10-minute increments
       const defaultEndDate = new Date();
       defaultEndDate.setDate(defaultEndDate.getDate() + 7);
       // Round minutes to nearest 10-minute increment
       const minutes = Math.round(defaultEndDate.getMinutes() / 10) * 10;
       defaultEndDate.setMinutes(minutes);
       // Format for datetime-local input (YYYY-MM-DDTHH:MM)
       const year = defaultEndDate.getFullYear();
       const month = String(defaultEndDate.getMonth() + 1).padStart(2, '0');
       const day = String(defaultEndDate.getDate()).padStart(2, '0');
       const hours = String(defaultEndDate.getHours()).padStart(2, '0');
       const minutesStr = String(minutes).padStart(2, '0');
       const formattedDate = `${year}-${month}-${day}T${hours}:${minutesStr}`;
      
      setFormData(prev => ({
        ...prev,
        endDate: formattedDate
      }));
    }
  }, [poll]);

  const handleInputChange = (field: string, value: any) => {
    if (field === 'endDate') {
      // Ensure time is rounded to 10-minute increments
      const date = new Date(value);
      const minutes = Math.round(date.getMinutes() / 10) * 10;
      date.setMinutes(minutes);
      
      // Format for datetime-local input (24-hour format for backend)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutesStr = String(minutes).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}T${hours}:${minutesStr}`;
      
      setFormData(prev => ({
        ...prev,
        [field]: formattedDate
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData(prev => ({
      ...prev,
      options: newOptions
    }));
  };

  const addOption = () => {
    if (formData.options.length < 10) {
      setFormData(prev => ({
        ...prev,
        options: [...prev.options, '']
      }));
    }
  };

  const removeOption = (index: number) => {
    if (formData.options.length > 2) {
      const newOptions = formData.options.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        options: newOptions
      }));
    }
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return false;
    }
    if (formData.options.length < 2) {
      setError('At least 2 options are required');
      return false;
    }
    if (formData.options.some(option => !option.trim())) {
      setError('All options must have text');
      return false;
    }
    if (!formData.endDate) {
      setError('End date is required');
      return false;
    }
    if (new Date(formData.endDate) <= new Date()) {
      setError('End date must be in the future');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        title: formData.title.trim(),
        options: formData.options.map(option => option.trim()),
        endDate: new Date(formData.endDate).toISOString(),
        allowMultipleVotes: formData.allowMultipleVotes,
        resultsVisible: formData.resultsVisible
      };

      if (isEditing) {
        await axios.put(`${API_URL}/api/polls/${poll._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/api/polls/courses/${courseId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save poll');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full h-[calc(100vh-8rem)] sm:max-h-[85vh] sm:h-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            {isEditing ? 'Edit Poll' : 'Create New Poll'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Poll Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              placeholder="e.g., What type of content would you prefer for next week?"
              maxLength={200}
            />
          </div>

          

                     {/* End Date */}
           <div>
             <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
               End Date *
             </label>
             <div className="grid grid-cols-2 gap-3">
               <div>
                 <label htmlFor="dateInput" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                   Date
                 </label>
                 <input
                   type="date"
                   id="dateInput"
                   name="dateInput"
                   value={formData.endDate.split('T')[0]}
                   onChange={(e) => {
                     const time = formData.endDate.split('T')[1] || '00:00';
                     handleInputChange('endDate', `${e.target.value}T${time}`);
                   }}
                   className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                   min={new Date().toISOString().split('T')[0]}
                 />
               </div>
                               <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="hourInput" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Hour
                    </label>
                    <select
                      id="hourInput"
                      name="hourInput"
                      value={(() => {
                        const time = formData.endDate.split('T')[1] || '00:00';
                        const hour = parseInt(time.split(':')[0]);
                        return hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                      })()}
                      onChange={(e) => {
                        const date = formData.endDate.split('T')[0];
                        const currentTime = formData.endDate.split('T')[1] || '00:00';
                        const currentHour = parseInt(currentTime.split(':')[0]);
                        const currentMinute = currentTime.split(':')[1];
                        const isPM = currentHour >= 12;
                        
                        let newHour = parseInt(e.target.value);
                        if (e.target.value === '12') {
                          newHour = isPM ? 12 : 0;
                        } else if (isPM) {
                          newHour += 12;
                        }
                        
                        const newTime = `${String(newHour).padStart(2, '0')}:${currentMinute}`;
                        handleInputChange('endDate', `${date}T${newTime}`);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(hour => (
                        <option key={hour} value={hour}>
                          {hour}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="minuteInput" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Minute
                    </label>
                    <select
                      id="minuteInput"
                      name="minuteInput"
                      value={formData.endDate.split('T')[1]?.split(':')[1] || '00'}
                      onChange={(e) => {
                        const date = formData.endDate.split('T')[0];
                        const currentTime = formData.endDate.split('T')[1] || '00:00';
                        const currentHour = currentTime.split(':')[0];
                        const newTime = `${currentHour}:${e.target.value}`;
                        handleInputChange('endDate', `${date}T${newTime}`);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    >
                      {[0, 10, 20, 30, 40, 50].map(minute => (
                        <option key={minute} value={String(minute).padStart(2, '0')}>
                          {String(minute).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="ampmInput" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      AM/PM
                    </label>
                    <select
                      id="ampmInput"
                      name="ampmInput"
                      value={(() => {
                        const time = formData.endDate.split('T')[1] || '00:00';
                        const hour = parseInt(time.split(':')[0]);
                        return hour >= 12 ? 'PM' : 'AM';
                      })()}
                      onChange={(e) => {
                        const date = formData.endDate.split('T')[0];
                        const currentTime = formData.endDate.split('T')[1] || '00:00';
                        const currentHour = parseInt(currentTime.split(':')[0]);
                        const currentMinute = currentTime.split(':')[1];
                        
                        let newHour = currentHour;
                        if (e.target.value === 'PM' && currentHour < 12) {
                          newHour = currentHour === 0 ? 12 : currentHour + 12;
                        } else if (e.target.value === 'AM' && currentHour >= 12) {
                          newHour = currentHour === 12 ? 0 : currentHour - 12;
                        }
                        
                        const newTime = `${String(newHour).padStart(2, '0')}:${currentMinute}`;
                        handleInputChange('endDate', `${date}T${newTime}`);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
             </div>
             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
               Select a date and time when the poll should end (10-minute increments)
             </p>
           </div>

          {/* Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Poll Options * (at least 2)
            </label>
            <div className="space-y-3">
              {formData.options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <label htmlFor={`poll-option-${index}`} className="sr-only">Option {index + 1}</label>
                  <input
                    type="text"
                    id={`poll-option-${index}`}
                    name={`poll-option-${index}`}
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    placeholder={`Option ${index + 1}`}
                    maxLength={200}
                  />
                  {formData.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="p-2 text-red-500 hover:text-red-700 transition-colors"
                      title="Remove option"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {formData.options.length < 10 && (
              <button
                type="button"
                onClick={addOption}
                className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </button>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Allow Multiple Votes
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Students can select multiple options
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="allowMultipleVotes"
                  name="allowMultipleVotes"
                  checked={formData.allowMultipleVotes}
                  onChange={(e) => handleInputChange('allowMultipleVotes', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Show Results to Students
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Students can see voting results before poll ends
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="resultsVisible"
                  name="resultsVisible"
                  checked={formData.resultsVisible}
                  onChange={(e) => handleInputChange('resultsVisible', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 -mx-4 sm:-mx-6 px-4 sm:px-6 pb-4 sm:pb-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  {isEditing ? 'Update Poll' : 'Create Poll'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PollForm; 