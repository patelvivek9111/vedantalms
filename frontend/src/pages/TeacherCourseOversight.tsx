import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import { getImageUrl } from '../services/api';
import { 
  BookOpen, 
  Search, 
  Edit, 
  Trash2, 
  Eye,
  EyeOff,
  Users,
  TrendingUp,
  User,
  Plus,
  ChevronDown,
  Copy,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import CourseCopyModal from '../components/course/CourseCopyModal';
import { archiveCourse, restoreCourse } from '../services/courseOpsApi';
import { BurgerMenu } from '../components/layout/BurgerMenu';
import DataTable, { Column } from '../components/common/DataTable';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { attachClassAveragesToCourses } from '../services/gradeAveragesService';

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
  const [courseToCopy, setCourseToCopy] = useState<Course | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Course | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Course | null>(null);

  const mapTeacherCourseRow = (course: any): Course => {
    let status: 'active' | 'draft' | 'archived' = 'active';
    if (course.operationalStatus === 'archived') {
      status = 'archived';
    } else if (!course.published) {
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
      classAverage: course.classAverage,
      catalog: course.catalog,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      status,
    };
  };

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
          const withAverages = await attachClassAveragesToCourses(coursesArray, headers);
          const coursesWithStats = withAverages.map(mapTeacherCourseRow);
          
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
      case 'active':
        return 'border border-emerald-200/90 bg-emerald-50/90 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200';
      case 'draft':
        return 'border border-amber-200/90 bg-amber-50/90 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200';
      case 'archived':
        return 'border border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-300';
      default:
        return 'border border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-300';
    }
  };

  const getPublishedColor = (published: boolean) => {
    return published
      ? 'border border-sky-200/90 bg-sky-50/90 text-sky-900 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-200'
      : 'border border-orange-200/90 bg-orange-50/90 text-orange-900 dark:border-orange-800/60 dark:bg-orange-950/40 dark:text-orange-200';
  };

  /** Grade band colors: informative, not “alarm red” for normal ranges */
  const getAverageColor = (average: number | undefined | null) => {
    if (average === undefined || average === null) {
      return 'text-gray-400 dark:text-gray-500';
    }
    if (average >= 90) return 'text-emerald-700 dark:text-emerald-300';
    if (average >= 80) return 'text-teal-700 dark:text-teal-300';
    if (average >= 70) return 'text-slate-700 dark:text-slate-300';
    if (average >= 60) return 'text-amber-700 dark:text-amber-300';
    return 'text-slate-600 dark:text-slate-400';
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
      case 'copy':
        setCourseToCopy(course);
        break;
      case 'archive':
        setArchiveTarget(course);
        break;
      case 'restore':
        setRestoreTarget(course);
        break;
    }
  };

  const applyArchive = async () => {
    if (!archiveTarget) return;
    try {
      await archiveCourse(archiveTarget._id);
      setCourses((prev) =>
        prev.map((c) => (c._id === archiveTarget._id ? { ...c, status: 'archived' as const } : c))
      );
      toast.success('Course archived. Content is read-only for students.');
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to archive course');
    } finally {
      setArchiveTarget(null);
    }
  };

  const applyRestore = async () => {
    if (!restoreTarget) return;
    try {
      await restoreCourse(restoreTarget._id);
      setCourses((prev) =>
        prev.map((c) =>
          c._id === restoreTarget._id ? { ...c, status: 'active' as const, published: true } : c
        )
      );
      toast.success('Course restored.');
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to restore course');
    } finally {
      setRestoreTarget(null);
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
          const withAverages = await attachClassAveragesToCourses(coursesArray, headers);
          const coursesWithStats = withAverages.map(mapTeacherCourseRow);
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
          const withAverages = await attachClassAveragesToCourses(coursesArray, headers);
          const coursesWithStats = withAverages.map(mapTeacherCourseRow);
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
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/courses/${course._id}`);
          }}
          className="text-left text-sm font-semibold text-gray-900 underline decoration-transparent underline-offset-2 transition-colors hover:text-blue-600 hover:decoration-blue-600/40 dark:text-gray-100 dark:hover:text-blue-400 dark:hover:decoration-blue-400/40"
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
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ${getStatusColor(course.status)}`}>
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
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${getPublishedColor(course.published)}`}>
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
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <Users className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden />
          <span className="text-sm tabular-nums font-medium">{course.enrollmentCount || 0}</span>
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
          <TrendingUp className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden />
          <span className={`text-sm tabular-nums font-medium ${getAverageColor(course.classAverage)}`}>
            {course.classAverage !== undefined && course.classAverage !== null 
              ? `${course.classAverage.toFixed(1)}%` 
              : '—'}
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
        <div
          className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200/90 bg-gray-50/80 p-0.5 dark:border-gray-600 dark:bg-gray-800/50"
          onClick={(e) => e.stopPropagation()}
          role="group"
          aria-label="Course actions"
        >
          <button
            type="button"
            onClick={() => handleCourseAction('edit', course)}
            className="rounded-md p-1.5 text-gray-600 transition-colors hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
            title="Edit course"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleCourseAction('view', course)}
            className="rounded-md p-1.5 text-gray-600 transition-colors hover:bg-white hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-blue-400"
            title="Open course"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleCourseAction('copy', course)}
            className="rounded-md p-1.5 text-gray-600 transition-colors hover:bg-white hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-indigo-400"
            title="Copy course"
          >
            <Copy className="h-4 w-4" />
          </button>
          {course.status === 'archived' ? (
            <button
              type="button"
              onClick={() => handleCourseAction('restore', course)}
              className="rounded-md p-1.5 text-gray-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
              title="Restore course"
            >
              <ArchiveRestore className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleCourseAction('archive', course)}
              className="rounded-md p-1.5 text-gray-600 transition-colors hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/40"
              title="Archive course"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => handleCourseAction('delete', course)}
            className="rounded-md p-1.5 text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950/50 dark:hover:text-red-400"
            title="Delete course"
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
      <div className="flex min-h-[40vh] items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
      </div>
    );
  }

  const tableShellClass =
    'overflow-auto max-h-[600px] rounded-2xl border border-gray-200/90 bg-white shadow-sm ring-1 ring-black/[0.03] dark:border-gray-700 dark:bg-gray-950/50 dark:shadow-none dark:ring-white/[0.04]';

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
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">My Courses</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
          
          {/* Burger Menu */}
          <BurgerMenu
            showBurgerMenu={showBurgerMenu}
            setShowBurgerMenu={setShowBurgerMenu}
          />
        </div>
      </nav>
      
      
      <div className="mx-auto max-w-7xl space-y-5 p-3 pt-20 sm:space-y-6 sm:p-4 lg:p-6 lg:pt-4">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="hidden text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 lg:block sm:text-3xl">
              My Courses
            </h1>
            <p className="mt-1 hidden max-w-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400 lg:block">
              Manage and monitor your courses
            </p>
            <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400 lg:hidden">
              Manage and monitor your courses
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-stretch">
            <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200/90 bg-white px-4 py-2.5 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900/40 sm:w-auto sm:justify-center">
              <BookOpen className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden />
              <span className="text-sm leading-none">
                <span className="tabular-nums font-semibold text-gray-900 dark:text-gray-100">{courses.length}</span>
                <span className="font-medium text-gray-500 dark:text-gray-400"> courses</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/courses/create')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold leading-none text-white shadow-sm transition-colors hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 sm:w-auto"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              Create course
            </button>
          </div>
        </div>

      {/* Filters */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/50 dark:shadow-none">
        <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800 sm:px-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Search & filters</h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Title, code, or description</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-12 sm:gap-3 sm:p-3 md:p-4">
          <div className="min-w-0 sm:col-span-6">
            <label htmlFor="teacher-courses-search" className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                id="teacher-courses-search"
                type="text"
                placeholder="Search…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
              />
            </div>
          </div>
          <div className="min-w-0 sm:col-span-3">
            <label htmlFor="teacher-courses-status" className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Status
            </label>
            <div className="relative">
              <select
                id="teacher-courses-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white px-2.5 pr-9 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
              >
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" aria-hidden />
            </div>
          </div>
          <div className="min-w-0 sm:col-span-3">
            <label htmlFor="teacher-courses-published" className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Visibility
            </label>
            <div className="relative">
              <select
                id="teacher-courses-published"
                value={publishedFilter}
                onChange={(e) => setPublishedFilter(e.target.value)}
                className="h-9 w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white px-2.5 pr-9 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
              >
                <option value="all">All</option>
                <option value="published">Published</option>
                <option value="unpublished">Unpublished</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      {/* Courses Table */}
      <DataTable<Course>
        data={filteredCourses}
        columns={teacherCourseColumns}
        tableClassName="[&_th]:py-3 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-wider [&_td]:py-3.5"
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
        estimatedRowHeight={56}
        tableContainerClassName={tableShellClass}
        bulkActionsClassName="rounded-xl border border-blue-200/80 bg-blue-50/90 dark:border-blue-800/50 dark:bg-blue-950/30"
        bulkActions={
          <>
            <button
              type="button"
              onClick={handleBulkPublish}
              disabled={bulkActionLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/90 bg-white px-3 py-2 text-xs font-medium text-emerald-800 shadow-sm transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800/60 dark:bg-gray-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40 sm:text-sm"
            >
              <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
              Publish
            </button>
            <button
              type="button"
              onClick={handleBulkUnpublish}
              disabled={bulkActionLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/90 bg-white px-3 py-2 text-xs font-medium text-amber-900 shadow-sm transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800/60 dark:bg-gray-900 dark:text-amber-200 dark:hover:bg-amber-950/40 sm:text-sm"
            >
              <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
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

      {courseToCopy && (
        <CourseCopyModal
          open={!!courseToCopy}
          courseId={courseToCopy._id}
          sourceTitle={courseToCopy.title}
          onClose={() => setCourseToCopy(null)}
          onSuccess={(newId) => {
            toast.success('Course copied');
            navigate(`/courses/${newId}`);
          }}
        />
      )}

      <ConfirmationModal
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={applyArchive}
        title="Archive course"
        message={`Archive "${archiveTarget?.title}"? Students lose write access; grades and transcripts are unchanged.`}
        confirmText="Archive"
        cancelText="Cancel"
        variant="warning"
      />

      <ConfirmationModal
        isOpen={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={applyRestore}
        title="Restore course"
        message={`Restore "${restoreTarget?.title}" to active operation?`}
        confirmText="Restore"
        cancelText="Cancel"
      />

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

