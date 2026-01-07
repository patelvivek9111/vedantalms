import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import { 
  BookOpen, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  TrendingUp
} from 'lucide-react';

interface Course {
  _id: string;
  title: string;
  description: string;
  instructor: string;
  published: boolean;
  enrollmentCount: number;
  classAverage?: number;
  catalog?: {
    courseCode?: string;
  };
  createdAt: string;
  lastUpdated: string;
  status: 'active' | 'draft' | 'archived';
}

export function AdminCourseOversight() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [publishedFilter, setPublishedFilter] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    instructor: '',
    status: 'active' as 'active' | 'draft' | 'archived'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (publishedFilter !== 'all') params.append('published', publishedFilter);
        if (searchTerm) params.append('search', searchTerm);
        
        const response = await axios.get(`${API_URL}/api/admin/courses?${params.toString()}`, { headers });
        
        if (response.data.success) {
          // Process courses to add class averages
          const coursesData = response.data.data;
          const coursesArray = Array.isArray(coursesData) ? coursesData : [];
          const coursesWithAverages = await Promise.all(coursesArray.map(async (course: any) => {
            try {
              // Calculate class average
              let classAverage: number | undefined = undefined;
              
              try {
                const averageResponse = await axios.get(
                  `${API_URL}/api/grades/course/${course._id}/average`,
                  { headers }
                );
                
                if (averageResponse.data && averageResponse.data.average !== null && averageResponse.data.average !== undefined) {
                  classAverage = averageResponse.data.average;
                }
              } catch (error) {
                // Skip if we can't get average (course might have no grades yet)
                }
              
              return {
                ...course,
                classAverage: classAverage
              };
            } catch (error) {
              return {
                ...course,
                classAverage: undefined
              };
            }
          }));
          
          setCourses(coursesWithAverages);
          setFilteredCourses(coursesWithAverages);
        }
      } catch (error) {
        } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [statusFilter, publishedFilter, searchTerm]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300';
      case 'draft': return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300';
      case 'archived': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  const getPublishedColor = (published: boolean) => {
    return published ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300';
  };

  const getAverageColor = (average: number | undefined | null) => {
    if (average === undefined || average === null) {
      return 'text-gray-500 dark:text-gray-400';
    }
    if (average >= 90) {
      return 'text-green-600 dark:text-green-400 font-semibold';
    } else if (average >= 80) {
      return 'text-blue-600 dark:text-blue-400 font-semibold';
    } else if (average >= 70) {
      return 'text-yellow-600 dark:text-yellow-400 font-semibold';
    } else if (average >= 60) {
      return 'text-orange-600 dark:text-orange-400 font-semibold';
    } else {
      return 'text-red-600 dark:text-red-400 font-semibold';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleCourseAction = (action: string, course: Course) => {
    switch (action) {
      case 'edit':
        setSelectedCourse(course);
        setEditFormData({
          title: course.title,
          description: course.description,
          instructor: course.instructor,
          status: course.status
        });
        setShowCourseModal(true);
        break;
      case 'delete':
        if (confirm(`Are you sure you want to delete ${course.title}?`)) {
          setCourses(courses.filter(c => c._id !== course._id));
        }
        break;
      case 'publish':
        setCourses(courses.map(c => 
          c._id === course._id ? { ...c, published: true, status: 'active' as const } : c
        ));
        break;
      case 'unpublish':
        setCourses(courses.map(c => 
          c._id === course._id ? { ...c, published: false } : c
        ));
        break;
      case 'archive':
        setCourses(courses.map(c => 
          c._id === course._id ? { ...c, status: 'archived' as const } : c
        ));
        break;
    }
  };

  const handleSaveCourse = async () => {
    if (!selectedCourse) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const response = await axios.put(
        `${API_URL}/api/courses/${selectedCourse._id}`,
        {
          title: editFormData.title,
          description: editFormData.description,
          status: editFormData.status
        },
        { headers }
      );
      
      if (response.data.success) {
        // Refresh courses list
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (publishedFilter !== 'all') params.append('published', publishedFilter);
        if (searchTerm) params.append('search', searchTerm);
        
        const refreshResponse = await axios.get(`${API_URL}/api/admin/courses?${params.toString()}`, { headers });
        if (refreshResponse.data.success) {
          // Process courses to add class averages
          const coursesData = refreshResponse.data.data;
          const coursesArray = Array.isArray(coursesData) ? coursesData : [];
          const coursesWithAverages = await Promise.all(coursesArray.map(async (course: any) => {
            try {
              // Calculate class average
              let classAverage: number | undefined = undefined;
              
              try {
                const averageResponse = await axios.get(
                  `${API_URL}/api/grades/course/${course._id}/average`,
                  { headers }
                );
                
                if (averageResponse.data && averageResponse.data.average !== null && averageResponse.data.average !== undefined) {
                  classAverage = averageResponse.data.average;
                }
              } catch (error) {
                // Skip if we can't get average (course might have no grades yet)
                }
              
              return {
                ...course,
                classAverage: classAverage
              };
            } catch (error) {
              return {
                ...course,
                classAverage: undefined
              };
            }
          }));
          
          setCourses(coursesWithAverages);
          setFilteredCourses(coursesWithAverages);
        }
        
        setShowCourseModal(false);
        setSelectedCourse(null);
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update course');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Course Oversight</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Monitor and manage all courses in the system</p>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{courses.length} courses</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border dark:border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Published</label>
            <select
              value={publishedFilter}
              onChange={(e) => setPublishedFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
          </div>

          <div className="flex items-end">
            <button className="w-full bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors">
              Create Course
            </button>
          </div>
        </div>
      </div>

      {/* Courses Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Course
                </th>
                <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Instructor
                </th>
                <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Published
                </th>
                <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Enrollment
                </th>
                <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Average
                </th>
                <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Updated
                </th>
                <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {courses.map((course) => (
                <tr key={course._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                    <button
                      onClick={() => navigate(`/courses/${course._id}`)}
                      className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer text-left"
                    >
                      {course.catalog?.courseCode || course.title}
                    </button>
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                    {course.instructor}
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(course.status)}`}>
                      {course.status}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPublishedColor(course.published)}`}>
                      {course.published ? 'Published' : 'Unpublished'}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                    <div className="flex items-center">
                      <Users className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 dark:text-gray-500 mr-1" />
                      <span className="text-xs sm:text-sm text-gray-900 dark:text-gray-100">{course.enrollmentCount}</span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                    <div className="flex items-center">
                      <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 dark:text-gray-500 mr-1" />
                      <span className={`text-xs sm:text-sm font-medium ${getAverageColor(course.classAverage)}`}>
                        {course.classAverage !== undefined && course.classAverage !== null 
                          ? `${course.classAverage.toFixed(1)}%` 
                          : 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(course.lastUpdated)}
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleCourseAction('edit', course)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {course.published ? (
                        <button
                          onClick={() => handleCourseAction('unpublish', course)}
                          className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300"
                        >
                          <EyeOff className="w-4 h-4" />
                        </button>
                      ) : (
                      <button
                        onClick={() => handleCourseAction('publish', course)}
                        className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      )}
                      <button
                        onClick={() => handleCourseAction('delete', course)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Course Modal */}
      {showCourseModal && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md border dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Edit Course</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instructor</label>
                <input
                  type="text"
                  value={editFormData.instructor}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                  disabled={saving}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Instructor cannot be changed from here</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as 'active' | 'draft' | 'archived' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  disabled={saving}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCourseModal(false);
                  setSelectedCourse(null);
                }}
                disabled={saving}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveCourse}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 