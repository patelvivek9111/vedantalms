import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { 
  BookOpen, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye,
  Users,
  CheckCircle,
  XCircle,
  TrendingUp
} from 'lucide-react';

interface Course {
  _id: string;
  title: string;
  description: string;
  instructor: any;
  published: boolean;
  students?: any[];
  enrollmentCount?: number;
  classAverage?: number;
  catalog?: {
    courseCode?: string;
  };
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'draft' | 'archived';
}

export function TeacherCourseOversight() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
    status: 'active' as 'active' | 'draft' | 'archived'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        
        // Fetch teacher's courses - the API already filters by instructor
        const response = await axios.get(`${API_URL}/api/courses`, { headers });
        
        if (response.data) {
          // Process courses to add stats
          const coursesWithStats = await Promise.all((response.data.data || response.data).map(async (course: any) => {
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
                console.warn(`Could not fetch class average for course ${course._id}:`, error);
              }
              
              // Determine status
              let status: 'active' | 'draft' | 'archived' = 'active';
              if (!course.published) {
                status = 'draft';
              }
              
              return {
                _id: course._id,
                title: course.title,
                description: course.description || '',
                instructor: course.instructor,
                published: course.published || false,
                students: course.students || [],
                enrollmentCount: course.students?.length || 0,
                classAverage: classAverage,
                catalog: course.catalog,
                createdAt: course.createdAt,
                updatedAt: course.updatedAt,
                status: status
              };
            } catch (error) {
              console.error(`Error processing course ${course._id}:`, error);
              return {
                ...course,
                enrollmentCount: course.students?.length || 0,
                classAverage: undefined,
                status: course.published ? 'active' : 'draft'
              };
            }
          }));
          
          setCourses(coursesWithStats);
          setFilteredCourses(coursesWithStats);
        }
      } catch (error) {
        console.error('Error fetching courses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // Filter courses based on search and filters
  useEffect(() => {
    let filtered = courses;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(course =>
        course.title.toLowerCase().includes(searchLower) ||
        course.catalog?.courseCode?.toLowerCase().includes(searchLower) ||
        (course.description && course.description.toLowerCase().includes(searchLower))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(course => course.status === statusFilter);
    }

    // Apply published filter
    if (publishedFilter !== 'all') {
      const isPublished = publishedFilter === 'published';
      filtered = filtered.filter(course => course.published === isPublished);
    }

    setFilteredCourses(filtered);
  }, [courses, searchTerm, statusFilter, publishedFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPublishedColor = (published: boolean) => {
    return published ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800';
  };

  const getAverageColor = (average: number | undefined | null) => {
    if (average === undefined || average === null) {
      return 'text-gray-500';
    }
    if (average >= 90) {
      return 'text-green-600 font-semibold';
    } else if (average >= 80) {
      return 'text-blue-600 font-semibold';
    } else if (average >= 70) {
      return 'text-yellow-600 font-semibold';
    } else if (average >= 60) {
      return 'text-orange-600 font-semibold';
    } else {
      return 'text-red-600 font-semibold';
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
          status: course.status
        });
        setShowCourseModal(true);
        break;
      case 'view':
        navigate(`/courses/${course._id}`);
        break;
      case 'delete':
        if (window.confirm(`Are you sure you want to delete "${course.title}"? This action cannot be undone.`)) {
          handleDeleteCourse(course._id);
        }
        break;
    }
  };

  const handleSaveCourse = async () => {
    if (!selectedCourse) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.put(`${API_URL}/api/courses/${selectedCourse._id}`, {
        title: editFormData.title,
        description: editFormData.description,
        published: editFormData.status === 'active'
      }, { headers });

      // Refresh courses list
      const response = await axios.get(`${API_URL}/api/courses`, { headers });
      if (response.data) {
        const coursesData = response.data.data || response.data;
        setCourses(coursesData);
        setFilteredCourses(coursesData);
      }

      setShowCourseModal(false);
      setSelectedCourse(null);
    } catch (error: any) {
      console.error('Error updating course:', error);
      alert(error.response?.data?.message || 'Failed to update course');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.delete(`${API_URL}/api/courses/${courseId}`, { headers });

      // Remove from local state
      setCourses(courses.filter(c => c._id !== courseId));
      setFilteredCourses(filteredCourses.filter(c => c._id !== courseId));
    } catch (error: any) {
      console.error('Error deleting course:', error);
      alert(error.response?.data?.message || 'Failed to delete course');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Courses</h1>
          <p className="text-gray-600">Manage and monitor your courses</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-600">
            <BookOpen className="h-5 w-5" />
            <span className="text-sm font-medium">{courses.length} course{courses.length !== 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={() => navigate('/courses/create')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
          >
            <BookOpen className="h-4 w-4" />
            Create Course
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select>
          <select
            value={publishedFilter}
            onChange={(e) => setPublishedFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>
        </div>
      </div>

      {/* Courses Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Course
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Published
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Enrollment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Average
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {searchTerm || statusFilter !== 'all' || publishedFilter !== 'all'
                      ? 'No courses match your filters'
                      : 'You haven\'t created any courses yet. Click "Create Course" to get started.'}
                  </td>
                </tr>
              ) : (
                filteredCourses.map((course) => (
                  <tr key={course._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/courses/${course._id}`)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-left"
                      >
                        {course.catalog?.courseCode || course.title}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(course.status)}`}>
                        {course.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPublishedColor(course.published)}`}>
                        {course.published ? 'Published' : 'Unpublished'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{course.enrollmentCount || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-gray-400" />
                        <span className={`text-sm font-medium ${getAverageColor(course.classAverage)}`}>
                          {course.classAverage !== undefined && course.classAverage !== null 
                            ? `${course.classAverage.toFixed(1)}%` 
                            : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(course.updatedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCourseAction('edit', course)}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Edit Course"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleCourseAction('view', course)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Course"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleCourseAction('delete', course)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete Course"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Course Modal */}
      {showCourseModal && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Edit Course</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Course Title</label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as 'active' | 'draft' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCourseModal(false);
                  setSelectedCourse(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCourse}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
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

