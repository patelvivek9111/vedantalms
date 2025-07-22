import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  Users,
  FileText,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';

interface Course {
  _id: string;
  title: string;
  description: string;
  instructor: string;
  published: boolean;
  enrollmentCount: number;
  assignmentCount: number;
  createdAt: string;
  lastUpdated: string;
  status: 'active' | 'draft' | 'archived';
}

export function AdminCourseOversight() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [publishedFilter, setPublishedFilter] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showCourseModal, setShowCourseModal] = useState(false);

  useEffect(() => {
    // Simulate loading courses
    setTimeout(() => {
      const mockCourses: Course[] = [
        {
          _id: '1',
          title: 'Mathematics 101',
          description: 'Introduction to basic mathematics concepts',
          instructor: 'Dr. John Smith',
          published: true,
          enrollmentCount: 45,
          assignmentCount: 12,
          createdAt: '2024-01-01T00:00:00Z',
          lastUpdated: '2024-01-15T10:30:00Z',
          status: 'active'
        },
        {
          _id: '2',
          title: 'English Literature',
          description: 'Study of classic and modern literature',
          instructor: 'Prof. Jane Doe',
          published: true,
          enrollmentCount: 38,
          assignmentCount: 8,
          createdAt: '2024-01-05T00:00:00Z',
          lastUpdated: '2024-01-14T15:20:00Z',
          status: 'active'
        },
        {
          _id: '3',
          title: 'Computer Science Fundamentals',
          description: 'Introduction to programming and algorithms',
          instructor: 'Dr. Bob Johnson',
          published: false,
          enrollmentCount: 0,
          assignmentCount: 15,
          createdAt: '2024-01-10T00:00:00Z',
          lastUpdated: '2024-01-16T09:15:00Z',
          status: 'draft'
        },
        {
          _id: '4',
          title: 'History of Art',
          description: 'Survey of art history from ancient to modern times',
          instructor: 'Prof. Alice Brown',
          published: true,
          enrollmentCount: 29,
          assignmentCount: 6,
          createdAt: '2023-12-15T00:00:00Z',
          lastUpdated: '2024-01-13T14:45:00Z',
          status: 'active'
        }
      ];
      setCourses(mockCourses);
      setFilteredCourses(mockCourses);
      setLoading(false);
    }, 1000);
  }, []);

  useEffect(() => {
    let filtered = courses;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.instructor.toLowerCase().includes(searchTerm.toLowerCase())
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleCourseAction = (action: string, course: Course) => {
    switch (action) {
      case 'edit':
        setSelectedCourse(course);
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
          <h1 className="text-3xl font-bold text-gray-900">Course Oversight</h1>
          <p className="text-gray-600">Monitor and manage all courses in the system</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-600">{filteredCourses.length} courses</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Published</label>
            <select
              value={publishedFilter}
              onChange={(e) => setPublishedFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
          </div>

          <div className="flex items-end">
            <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Create Course
            </button>
          </div>
        </div>
      </div>

      {/* Courses Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Course
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Instructor
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
                  Assignments
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCourses.map((course) => (
                <tr key={course._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{course.title}</div>
                      <div className="text-sm text-gray-500">{course.description}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {course.instructor}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(course.status)}`}>
                      {course.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPublishedColor(course.published)}`}>
                      {course.published ? 'Published' : 'Unpublished'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-900">{course.enrollmentCount}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-900">{course.assignmentCount}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(course.lastUpdated)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleCourseAction('edit', course)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {course.published ? (
                        <button
                          onClick={() => handleCourseAction('unpublish', course)}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          <EyeOff className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCourseAction('publish', course)}
                          className="text-green-600 hover:text-green-900"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleCourseAction('archive', course)}
                        className="text-orange-600 hover:text-orange-900"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCourseAction('delete', course)}
                        className="text-red-600 hover:text-red-900"
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Course</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  defaultValue={selectedCourse.title}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  defaultValue={selectedCourse.description}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructor</label>
                <input
                  type="text"
                  defaultValue={selectedCourse.instructor}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  defaultValue={selectedCourse.status}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCourseModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 