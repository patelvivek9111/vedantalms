import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../services/api';
import { 
  BookOpen, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye,
  EyeOff,
  Users,
  CheckCircle,
  XCircle,
  TrendingUp,
  User
} from 'lucide-react';
import { BurgerMenu } from '../components/BurgerMenu';
import DataTable, { Column } from '../components/common/DataTable';
import ConfirmationModal from '../components/common/ConfirmationModal';

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
  const { user, logout } = useAuth();
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
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  // Confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        
        // Fetch teacher's courses - the API already filters by instructor
        const response = await axios.get(`${API_URL}/api/courses`, { headers });
        
        if (response.data) {
          // Process courses to add stats
          const coursesData = response.data.data || response.data;
          const coursesArray = Array.isArray(coursesData) ? coursesData : [];
          const coursesWithStats = await Promise.all(coursesArray.map(async (course: any) => {
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
          status: course.status
        });
        setShowCourseModal(true);
        break;
      case 'view':
        navigate(`/courses/${course._id}`);
        break;
      case 'delete':
        setCourseToDelete(course);
        setShowDeleteConfirm(true);
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
      toast.error(error.response?.data?.message || 'Failed to update course');
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
      toast.success('Course deleted successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete course');
    }
  };

  // Bulk action handlers
  const handleBulkPublish = async () => {
    if (selectedCourseIds.length === 0) {
      toast.warn('Please select at least one course');
      return;
    }

    setBulkActionLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    let successCount = 0;
    let failCount = 0;

    try {
      await Promise.all(selectedCourseIds.map(async (id) => {
        try {
          await axios.patch(`${API_URL}/api/courses/${id}/publish`, { published: true }, { headers });
          successCount++;
        } catch (error) {
          failCount++;
        }
      }));

      if (successCount > 0) {
        // Refresh courses
        const response = await axios.get(`${API_URL}/api/courses`, { headers });
        if (response.data) {
          const coursesData = response.data.data || response.data;
          const coursesArray = Array.isArray(coursesData) ? coursesData : [];
          const coursesWithStats = await Promise.all(coursesArray.map(async (course: any) => {
            try {
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
                // Skip if we can't get average
              }
              
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
        toast.success(`Successfully published ${successCount} course${successCount !== 1 ? 's' : ''}`);
      }
      if (failCount > 0) {
        toast.error(`Failed to publish ${failCount} course${failCount !== 1 ? 's' : ''}`);
      }
      setSelectedCourseIds([]);
    } catch (error) {
      toast.error('Error during bulk publish operation');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkUnpublish = async () => {
    if (selectedCourseIds.length === 0) {
      toast.warn('Please select at least one course');
      return;
    }

    setBulkActionLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    let successCount = 0;
    let failCount = 0;

    try {
      await Promise.all(selectedCourseIds.map(async (id) => {
        try {
          await axios.patch(`${API_URL}/api/courses/${id}/publish`, { published: false }, { headers });
          successCount++;
        } catch (error) {
          failCount++;
        }
      }));

      if (successCount > 0) {
        // Refresh courses
        const response = await axios.get(`${API_URL}/api/courses`, { headers });
        if (response.data) {
          const coursesData = response.data.data || response.data;
          const coursesArray = Array.isArray(coursesData) ? coursesData : [];
          const coursesWithStats = await Promise.all(coursesArray.map(async (course: any) => {
            try {
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
                // Skip if we can't get average
              }
              
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
        toast.success(`Successfully unpublished ${successCount} course${successCount !== 1 ? 's' : ''}`);
      }
      if (failCount > 0) {
        toast.error(`Failed to unpublish ${failCount} course${failCount !== 1 ? 's' : ''}`);
      }
      setSelectedCourseIds([]);
    } catch (error) {
      toast.error('Error during bulk unpublish operation');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Define columns for courses table
  const teacherCourseColumns = useMemo<Column<Course>[]>(() => [
    {
      key: 'title',
      label: 'Course',
      sortable: true,
      render: (course) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/courses/${course._id}`);
          }}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-left"
        >
          {course.catalog?.courseCode || course.title}
        </button>
      ),
      className: 'whitespace-nowrap',
      sortFn: (a, b) => {
        const aTitle = a.catalog?.courseCode || a.title;
        const bTitle = b.catalog?.courseCode || b.title;
        return aTitle.localeCompare(bTitle);
      }
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (course) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(course.status)}`}>
          {course.status}
        </span>
      ),
      className: 'whitespace-nowrap',
      sortFn: (a, b) => {
        const statusOrder = ['active', 'draft', 'archived'];
        return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
      }
    },
    {
      key: 'published',
      label: 'Published',
      sortable: true,
      render: (course) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPublishedColor(course.published)}`}>
          {course.published ? 'Published' : 'Unpublished'}
        </span>
      ),
      className: 'whitespace-nowrap',
      sortFn: (a, b) => (a.published ? 1 : 0) - (b.published ? 1 : 0)
    },
    {
      key: 'enrollmentCount',
      label: 'Enrollment',
      sortable: true,
      render: (course) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <span className="text-sm text-gray-900 dark:text-gray-100">{course.enrollmentCount || 0}</span>
        </div>
      ),
      className: 'whitespace-nowrap',
      sortFn: (a, b) => (a.enrollmentCount || 0) - (b.enrollmentCount || 0)
    },
    {
      key: 'classAverage',
      label: 'Average',
      sortable: true,
      render: (course) => (
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <span className={`text-sm font-medium ${getAverageColor(course.classAverage)}`}>
            {course.classAverage !== undefined && course.classAverage !== null 
              ? `${course.classAverage.toFixed(1)}%` 
              : 'N/A'}
          </span>
        </div>
      ),
      className: 'whitespace-nowrap',
      sortFn: (a, b) => {
        const aAvg = a.classAverage ?? -1;
        const bAvg = b.classAverage ?? -1;
        return aAvg - bAvg;
      }
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sortable: true,
      render: (course) => formatDate(course.updatedAt),
      className: 'whitespace-nowrap text-gray-500 dark:text-gray-400',
      sortFn: (a, b) => {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (course) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleCourseAction('edit', course)}
            className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300"
            title="Edit Course"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleCourseAction('view', course)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
            title="View Course"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleCourseAction('delete', course)}
            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
            title="Delete Course"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
      className: 'whitespace-nowrap'
    }
  ], [navigate, handleCourseAction]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar (Mobile Only) */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setShowBurgerMenu(!showBurgerMenu)}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Open account menu"
          >
            <User className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">My Course</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
          
          {/* Burger Menu */}
          <BurgerMenu
            showBurgerMenu={showBurgerMenu}
            setShowBurgerMenu={setShowBurgerMenu}
          />
        </div>
      </nav>
      
      
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 pt-20 lg:pt-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <div>
            <h1 className="hidden lg:block text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">My Courses</h1>
            <p className="hidden lg:block text-sm sm:text-base text-gray-600 dark:text-gray-400">Manage and monitor your courses</p>
            <p className="lg:hidden text-sm text-gray-600 dark:text-gray-400 mt-2">Manage and monitor your courses</p>
          </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm font-medium">{courses.length} course{courses.length !== 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={() => navigate('/courses/create')}
            className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <BookOpen className="h-4 w-4" />
            Create Course
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select>
          <select
            value={publishedFilter}
            onChange={(e) => setPublishedFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          >
            <option value="all">All</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>
        </div>
      </div>

      {/* Courses Table */}
      <DataTable<Course>
        data={filteredCourses}
        columns={teacherCourseColumns}
        keyExtractor={(course) => course._id}
        emptyMessage={
          searchTerm || statusFilter !== 'all' || publishedFilter !== 'all'
                      ? 'No courses match your filters'
            : 'You haven\'t created any courses yet. Click "Create Course" to get started.'
        }
        pageSize={25}
        selectable={true}
        selectedKeys={selectedCourseIds}
        onSelectionChange={setSelectedCourseIds}
        virtualScrolling={true}
        virtualScrollingThreshold={100}
        virtualScrollingHeight={600}
        estimatedRowHeight={60}
        bulkActions={
          <>
                      <button
              onClick={handleBulkPublish}
              disabled={bulkActionLoading}
              className="px-3 py-1.5 text-xs sm:text-sm bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
              Publish
                        </button>
                        <button
              onClick={handleBulkUnpublish}
              disabled={bulkActionLoading}
              className="px-3 py-1.5 text-xs sm:text-sm bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
              <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" />
              Unpublish
                        </button>
          </>
        }
        onRowClick={(course, e) => {
          // Don't navigate if clicking on buttons
          const target = e.target as HTMLElement;
          if (target.tagName === 'BUTTON' || target.closest('button')) {
            return;
          }
          navigate(`/courses/${course._id}`);
        }}
      />

      {/* Edit Course Modal */}
      {showCourseModal && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Edit Course</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Course Title</label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as 'active' | 'draft' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCourseModal(false);
                  setSelectedCourse(null);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCourse}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Course Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setCourseToDelete(null);
        }}
        onConfirm={() => {
          if (courseToDelete) {
            handleDeleteCourse(courseToDelete._id);
            setShowDeleteConfirm(false);
            setCourseToDelete(null);
          }
        }}
        title="Delete Course"
        message={`Are you sure you want to delete "${courseToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
      </div>
    </div>
  );
}

