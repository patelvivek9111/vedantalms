import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
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
  TrendingUp,
  Archive
} from 'lucide-react';
import DataTable, { Column } from '../components/common/DataTable';
import ConfirmationModal from '../components/common/ConfirmationModal';

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
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  // Confirmation modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [showBulkArchiveConfirm, setShowBulkArchiveConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

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

  const handleCourseAction = async (action: string, course: Course) => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

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
        setCourseToDelete(course);
        setShowDeleteConfirm(true);
        break;
      case 'publish':
        try {
          await axios.patch(`${API_URL}/api/courses/${course._id}/publish`, { published: true }, { headers });
        setCourses(courses.map(c => 
          c._id === course._id ? { ...c, published: true, status: 'active' as const } : c
        ));
          setFilteredCourses(filteredCourses.map(c => 
            c._id === course._id ? { ...c, published: true, status: 'active' as const } : c
          ));
          toast.success('Course published successfully');
        } catch (error: any) {
          toast.error(error.response?.data?.message || 'Failed to publish course');
        }
        break;
      case 'unpublish':
        try {
          await axios.patch(`${API_URL}/api/courses/${course._id}/publish`, { published: false }, { headers });
        setCourses(courses.map(c => 
          c._id === course._id ? { ...c, published: false } : c
        ));
          setFilteredCourses(filteredCourses.map(c => 
            c._id === course._id ? { ...c, published: false } : c
          ));
          toast.success('Course unpublished successfully');
        } catch (error: any) {
          toast.error(error.response?.data?.message || 'Failed to unpublish course');
        }
        break;
      case 'archive':
        try {
          await axios.patch(`${API_URL}/api/courses/${course._id}`, { status: 'archived' }, { headers });
        setCourses(courses.map(c => 
          c._id === course._id ? { ...c, status: 'archived' as const } : c
        ));
          setFilteredCourses(filteredCourses.map(c => 
            c._id === course._id ? { ...c, status: 'archived' as const } : c
          ));
          toast.success('Course archived successfully');
        } catch (error: any) {
          toast.error(error.response?.data?.message || 'Failed to archive course');
        }
        break;
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
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (publishedFilter !== 'all') params.append('published', publishedFilter);
        if (searchTerm) params.append('search', searchTerm);
        
        const refreshResponse = await axios.get(`${API_URL}/api/admin/courses?${params.toString()}`, { headers });
        if (refreshResponse.data.success) {
          const coursesData = refreshResponse.data.data;
          const coursesArray = Array.isArray(coursesData) ? coursesData : [];
          const coursesWithAverages = await Promise.all(coursesArray.map(async (course: any) => {
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
              return { ...course, classAverage };
            } catch (error) {
              return { ...course, classAverage: undefined };
            }
          }));
          setCourses(coursesWithAverages);
          setFilteredCourses(coursesWithAverages);
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
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (publishedFilter !== 'all') params.append('published', publishedFilter);
        if (searchTerm) params.append('search', searchTerm);
        
        const refreshResponse = await axios.get(`${API_URL}/api/admin/courses?${params.toString()}`, { headers });
        if (refreshResponse.data.success) {
          const coursesData = refreshResponse.data.data;
          const coursesArray = Array.isArray(coursesData) ? coursesData : [];
          const coursesWithAverages = await Promise.all(coursesArray.map(async (course: any) => {
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
              return { ...course, classAverage };
            } catch (error) {
              return { ...course, classAverage: undefined };
            }
          }));
          setCourses(coursesWithAverages);
          setFilteredCourses(coursesWithAverages);
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

  const handleBulkArchive = () => {
    if (selectedCourseIds.length === 0) {
      toast.warn('Please select at least one course');
      return;
    }
    setShowBulkArchiveConfirm(true);
  };

  const confirmBulkArchive = async () => {
    setShowBulkArchiveConfirm(false);

    setBulkActionLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    let successCount = 0;
    let failCount = 0;

    try {
      await Promise.all(selectedCourseIds.map(async (id) => {
        try {
          await axios.patch(`${API_URL}/api/courses/${id}`, { status: 'archived' }, { headers });
          successCount++;
        } catch (error) {
          failCount++;
        }
      }));

      if (successCount > 0) {
        // Refresh courses
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (publishedFilter !== 'all') params.append('published', publishedFilter);
        if (searchTerm) params.append('search', searchTerm);
        
        const refreshResponse = await axios.get(`${API_URL}/api/admin/courses?${params.toString()}`, { headers });
        if (refreshResponse.data.success) {
          const coursesData = refreshResponse.data.data;
          const coursesArray = Array.isArray(coursesData) ? coursesData : [];
          const coursesWithAverages = await Promise.all(coursesArray.map(async (course: any) => {
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
              return { ...course, classAverage };
            } catch (error) {
              return { ...course, classAverage: undefined };
            }
          }));
          setCourses(coursesWithAverages);
          setFilteredCourses(coursesWithAverages);
        }
        toast.success(`Successfully archived ${successCount} course${successCount !== 1 ? 's' : ''}`);
      }
      if (failCount > 0) {
        toast.error(`Failed to archive ${failCount} course${failCount !== 1 ? 's' : ''}`);
      }
      setSelectedCourseIds([]);
    } catch (error) {
      toast.error('Error during bulk archive operation');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedCourseIds.length === 0) {
      toast.warn('Please select at least one course');
      return;
    }
    setShowBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    setShowBulkDeleteConfirm(false);

    setBulkActionLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    let successCount = 0;
    let failCount = 0;

    try {
      await Promise.all(selectedCourseIds.map(async (id) => {
        try {
          await axios.delete(`${API_URL}/api/courses/${id}`, { headers });
          successCount++;
        } catch (error) {
          failCount++;
        }
      }));

      if (successCount > 0) {
        setCourses(courses.filter(c => !selectedCourseIds.includes(c._id)));
        setFilteredCourses(filteredCourses.filter(c => !selectedCourseIds.includes(c._id)));
        toast.success(`Successfully deleted ${successCount} course${successCount !== 1 ? 's' : ''}`);
      }
      if (failCount > 0) {
        toast.error(`Failed to delete ${failCount} course${failCount !== 1 ? 's' : ''}`);
      }
      setSelectedCourseIds([]);
    } catch (error) {
      toast.error('Error during bulk delete operation');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Define columns for courses table (must be after handleCourseAction is defined)
  const courseColumns = useMemo<Column<Course>[]>(() => [
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
          className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer text-left"
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
      key: 'instructor',
      label: 'Instructor',
      sortable: true,
      className: 'whitespace-nowrap text-gray-900 dark:text-gray-100'
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (course) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(course.status)}`}>
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
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPublishedColor(course.published)}`}>
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
        <div className="flex items-center">
          <Users className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 dark:text-gray-500 mr-1" />
          <span className="text-xs sm:text-sm text-gray-900 dark:text-gray-100">{course.enrollmentCount}</span>
        </div>
      ),
      className: 'whitespace-nowrap',
      sortFn: (a, b) => a.enrollmentCount - b.enrollmentCount
    },
    {
      key: 'classAverage',
      label: 'Average',
      sortable: true,
      render: (course) => (
        <div className="flex items-center">
          <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 dark:text-gray-500 mr-1" />
          <span className={`text-xs sm:text-sm font-medium ${getAverageColor(course.classAverage)}`}>
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
      key: 'lastUpdated',
      label: 'Updated',
      sortable: true,
      render: (course) => formatDate(course.lastUpdated),
      className: 'whitespace-nowrap text-gray-500 dark:text-gray-400',
      sortFn: (a, b) => {
        return new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime();
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (course) => (
        <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
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
      ),
      className: 'text-right',
      headerClassName: 'text-right'
    }
  ], [navigate, handleCourseAction]);

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
      <DataTable<Course>
        data={filteredCourses}
        columns={courseColumns}
        keyExtractor={(course) => course._id}
        emptyMessage="No courses found"
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
                        <button
              onClick={handleBulkArchive}
              disabled={bulkActionLoading}
              className="px-3 py-1.5 text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
              <Archive className="w-3 h-3 sm:w-4 sm:h-4" />
              Archive
                        </button>
                      <button
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
              className="px-3 py-1.5 text-xs sm:text-sm bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
              Delete
                      </button>
          </>
        }
        onRowClick={(course, e) => {
          // Don't navigate if clicking on buttons or links
          const target = e.target as HTMLElement;
          if (target.tagName === 'BUTTON' || target.closest('button') || target.closest('a')) {
            return;
          }
          navigate(`/courses/${course._id}`);
        }}
      />

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

      {/* Delete Course Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setCourseToDelete(null);
        }}
        onConfirm={async () => {
          if (!courseToDelete) return;
          const token = localStorage.getItem('token');
          const headers = { Authorization: `Bearer ${token}` };
          try {
            await axios.delete(`${API_URL}/api/courses/${courseToDelete._id}`, { headers });
            setCourses(courses.filter(c => c._id !== courseToDelete._id));
            setFilteredCourses(filteredCourses.filter(c => c._id !== courseToDelete._id));
            toast.success('Course deleted successfully');
            setShowDeleteConfirm(false);
            setCourseToDelete(null);
          } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete course');
          }
        }}
        title="Delete Course"
        message={`Are you sure you want to delete "${courseToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Bulk Archive Confirmation Modal */}
      <ConfirmationModal
        isOpen={showBulkArchiveConfirm}
        onClose={() => setShowBulkArchiveConfirm(false)}
        onConfirm={confirmBulkArchive}
        title="Archive Courses"
        message={`Are you sure you want to archive ${selectedCourseIds.length} course${selectedCourseIds.length !== 1 ? 's' : ''}?`}
        confirmText="Archive"
        cancelText="Cancel"
        variant="warning"
        isLoading={bulkActionLoading}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={confirmBulkDelete}
        title="Delete Courses"
        message={`Are you sure you want to delete ${selectedCourseIds.length} course${selectedCourseIds.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={bulkActionLoading}
      />
    </div>
  );
} 