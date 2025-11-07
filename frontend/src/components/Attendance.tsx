import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  CheckSquare, 
  Calendar, 
  Users, 
  Clock, 
  BarChart3, 
  Settings, 
  Download, 
  Upload, 
  Filter,
  Search,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  MinusCircle,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

// Attendance status types
const ATTENDANCE_STATUSES = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  EXCUSED: 'excused',
  UNMARKED: 'unmarked'
};

const STATUS_CONFIG = {
  [ATTENDANCE_STATUSES.PRESENT]: {
    label: 'Present',
    color: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800',
    icon: CheckCircle,
    shortLabel: 'P'
  },
  [ATTENDANCE_STATUSES.ABSENT]: {
    label: 'Absent',
    color: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
    icon: XCircle,
    shortLabel: 'A'
  },
  [ATTENDANCE_STATUSES.LATE]: {
    label: 'Late',
    color: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
    icon: AlertCircle,
    shortLabel: 'L'
  },
  [ATTENDANCE_STATUSES.EXCUSED]: {
    label: 'Excused',
    color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    icon: MinusCircle,
    shortLabel: 'E'
  },
  [ATTENDANCE_STATUSES.UNMARKED]: {
    label: 'Unmarked',
    color: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600',
    icon: CheckSquare,
    shortLabel: '-'
  }
};

// Helper function to generate calendar days for a given month
const generateCalendarDays = (dateString: string) => {
  if (!dateString) {
    // If no date provided, use current month
    const today = new Date();
    dateString = today.toISOString().split('T')[0];
  }
  // Add time to avoid timezone issues when parsing date
  const date = new Date(dateString + 'T00:00:00');
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Get first day of month and last day of month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // Get the day of week for first day (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfWeek = firstDay.getDay();
  
  // Get the last date of the month
  const lastDate = lastDay.getDate();
  
  const days = [];
  
  // Add empty days for padding before the first day of the month
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push({ date: null, isCurrentMonth: false });
  }
  
  // Add all days of the current month
  for (let i = 1; i <= lastDate; i++) {
    const dayDate = new Date(year, month, i);
    days.push({
      date: dayDate.toISOString().split('T')[0],
      isCurrentMonth: true,
      dayNumber: i
    });
  }
  
  // Add empty days to complete the grid (6 rows * 7 columns = 42 total)
  const remainingDays = 42 - days.length;
  for (let i = 0; i < remainingDays; i++) {
    days.push({ date: null, isCurrentMonth: false });
  }
  
  return days;
};

// Calendar Day Component
interface CalendarDayProps {
  day: { date: string | null; isCurrentMonth: boolean; dayNumber?: number };
  courseId: string | undefined;
  isInstructor: boolean;
  onDateSelect: (date: string) => void;
  selectedDate: string;
}

const CalendarDay: React.FC<CalendarDayProps> = ({ day, courseId, isInstructor, onDateSelect, selectedDate }) => {
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (day.date && day.isCurrentMonth && courseId) {
      fetchDayAttendance(day.date);
    } else {
      setAttendanceData([]);
    }
  }, [day.date, day.isCurrentMonth, courseId]);

  const fetchDayAttendance = async (date: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token || !courseId) {
        setAttendanceData([]);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API_URL}/api/courses/${courseId}/attendance?date=${date}`, { headers });
      const allAttendanceData = response.data || [];
      
      // Filter data based on user role
      if (isInstructor || user?.role === 'admin') {
        // Teachers/Admins see all students
        setAttendanceData(Array.isArray(allAttendanceData) ? allAttendanceData : []);
      } else {
        // Students only see their own attendance
        const studentAttendanceData = (Array.isArray(allAttendanceData) ? allAttendanceData : []).filter((record: any) => 
          record.studentId === user?._id
        );
        setAttendanceData(studentAttendanceData);
      }
    } catch (error) {
      // If no attendance data exists, return empty array
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceBreakdown = () => {
    if (!day.date || !day.isCurrentMonth) {
      return null;
    }

    // If no attendance data, return null (will show empty state)
    if (!attendanceData || attendanceData.length === 0) {
      return null;
    }

    // For students, show only their own status
    if (!isInstructor && user?.role !== 'admin') {
      const studentRecord = attendanceData[0]; // Should only be one record for students
      if (!studentRecord) return null;
      
      return {
        studentStatus: studentRecord.status,
        isStudent: true
      };
    }

    // For teachers/admins, show aggregated data
    const totalCount = attendanceData.length;
    if (totalCount === 0) return null;

    const breakdown = {
      present: attendanceData.filter(record => record.status === 'present').length,
      absent: attendanceData.filter(record => record.status === 'absent').length,
      late: attendanceData.filter(record => record.status === 'late').length,
      excused: attendanceData.filter(record => record.status === 'excused').length,
      unmarked: attendanceData.filter(record => record.status === 'unmarked').length
    };

    return {
      ...breakdown,
      total: totalCount,
      percentages: {
        present: (breakdown.present / totalCount) * 100,
        absent: (breakdown.absent / totalCount) * 100,
        late: (breakdown.late / totalCount) * 100,
        excused: (breakdown.excused / totalCount) * 100,
        unmarked: (breakdown.unmarked / totalCount) * 100
      },
      isStudent: false
    };
  };

  if (!day.isCurrentMonth) {
    return <div className="p-3 text-center text-gray-300 dark:text-gray-600 bg-gray-50 dark:bg-gray-900"></div>;
  }

  const breakdown = getAttendanceBreakdown();
  const isSelected = day.date === selectedDate;

  return (
    <div 
      className={`p-3 text-center cursor-pointer border rounded-lg transition-all hover:shadow-sm ${
        isSelected 
          ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 shadow-md' 
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}
      onClick={() => day.date && onDateSelect(day.date)}
    >
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{day.dayNumber}</div>
      
      {loading ? (
        <div className="w-2 h-2 bg-gray-400 rounded-full mx-auto animate-pulse"></div>
      ) : breakdown ? (
        <div className="space-y-1">
          {breakdown.isStudent ? (
            // Student view - show only their own status
            <div className="space-y-1">
              <div className="flex h-2 rounded-full overflow-hidden">
                {breakdown.studentStatus === 'present' && (
                  <div className="bg-green-500 w-full" title="Present"></div>
                )}
                {breakdown.studentStatus === 'absent' && (
                  <div className="bg-red-500 w-full" title="Absent"></div>
                )}
                {breakdown.studentStatus === 'late' && (
                  <div className="bg-yellow-500 w-full" title="Late"></div>
                )}
                {breakdown.studentStatus === 'excused' && (
                  <div className="bg-blue-500 w-full" title="Excused"></div>
                )}
                {breakdown.studentStatus === 'unmarked' && (
                  <div className="bg-gray-400 w-full" title="Unmarked"></div>
                )}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {breakdown.studentStatus === 'present' && 'Present'}
                {breakdown.studentStatus === 'absent' && 'Absent'}
                {breakdown.studentStatus === 'late' && 'Late'}
                {breakdown.studentStatus === 'excused' && 'Excused'}
                {breakdown.studentStatus === 'unmarked' && 'Unmarked'}
              </div>
            </div>
          ) : (
            // Teacher/Admin view - show aggregated data
            <>
              {/* Visual breakdown bar */}
              <div className="flex h-2 rounded-full overflow-hidden">
                {!breakdown.isStudent && (breakdown as any).present > 0 && (
                  <div 
                    className="bg-green-500" 
                    style={{ width: `${(breakdown as any).percentages.present}%` }}
                    title={`Present: ${(breakdown as any).present}/${(breakdown as any).total}`}
                  ></div>
                )}
                {!breakdown.isStudent && (breakdown as any).absent > 0 && (
                  <div 
                    className="bg-red-500" 
                    style={{ width: `${(breakdown as any).percentages.absent}%` }}
                    title={`Absent: ${(breakdown as any).absent}/${(breakdown as any).total}`}
                  ></div>
                )}
                {!breakdown.isStudent && (breakdown as any).late > 0 && (
                  <div 
                    className="bg-yellow-500" 
                    style={{ width: `${(breakdown as any).percentages.late}%` }}
                    title={`Late: ${(breakdown as any).late}/${(breakdown as any).total}`}
                  ></div>
                )}
                {!breakdown.isStudent && (breakdown as any).excused > 0 && (
                  <div 
                    className="bg-blue-500" 
                    style={{ width: `${(breakdown as any).percentages.excused}%` }}
                    title={`Excused: ${(breakdown as any).excused}/${(breakdown as any).total}`}
                  ></div>
                )}
                {!breakdown.isStudent && (breakdown as any).unmarked > 0 && (
                  <div 
                    className="bg-gray-400" 
                    style={{ width: `${(breakdown as any).percentages.unmarked}%` }}
                    title={`Unmarked: ${(breakdown as any).unmarked}/${(breakdown as any).total}`}
                  ></div>
                )}
              </div>
              
              {/* Attendance count */}
              {!breakdown.isStudent && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {(breakdown as any).present}/{(breakdown as any).total}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto"></div>
      )}
    </div>
  );
};

const Attendance: React.FC = () => {
  const { id: courseId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isInstructor, setIsInstructor] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'calendar'>('daily');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [attendanceSettings, setAttendanceSettings] = useState({
    autoMarkAbsent: false,
    lateThreshold: 15, // minutes
    allowExcused: true,
    requireReason: false,
    gradeIntegration: false
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get authentication token
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No authentication token found');
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };
        
        // Fetch course details to check if user is instructor
        const courseResponse = await axios.get(`${API_URL}/api/courses/${courseId}`, { headers });
        const course = courseResponse.data;
        
        // Check if course data is nested in a 'data' property
        const actualCourseData = course.data || course;
        setCourseData(actualCourseData);
        
        // Check if user is instructor (either assigned instructor or any teacher for now)
        const isUserInstructor = user?.role === 'teacher' && (
          !actualCourseData.instructor || 
          actualCourseData.instructor._id === user._id || 
          actualCourseData.instructor === user._id
        );
        setIsInstructor(isUserInstructor);

        // Fetch attendance data for the current date
        const currentDate = new Date().toISOString().split('T')[0];
        setSelectedDate(currentDate);
        
        try {
          const attendanceResponse = await axios.get(`${API_URL}/api/courses/${courseId}/attendance?date=${currentDate}`, { headers });
          const allAttendanceData = attendanceResponse.data;
          
          // Filter data based on user role
          if (isUserInstructor || user?.role === 'admin') {
            // Teachers/Admins see all students
            setAttendanceData(allAttendanceData);
          } else {
            // Students only see their own attendance
            const studentAttendanceData = allAttendanceData.filter((record: any) => 
              record.studentId === user?._id
            );
            setAttendanceData(studentAttendanceData);
          }
        } catch (attendanceError) {
          // If no attendance data exists, create default records
          if (isUserInstructor || user?.role === 'admin') {
            // For teachers/admins, create records for all students
            const studentsResponse = await axios.get(`${API_URL}/api/courses/${courseId}/students`, { headers });
            const defaultAttendanceData = studentsResponse.data.map((student: any) => ({
              studentId: student._id,
              studentName: `${student.firstName} ${student.lastName}`,
              email: student.email,
              status: ATTENDANCE_STATUSES.UNMARKED,
              date: currentDate,
              timestamp: null,
              reason: '',
              notes: ''
            }));
            setAttendanceData(defaultAttendanceData);
          } else {
            // For students, create only their own record
            const defaultAttendanceData = [{
              studentId: user?._id,
              studentName: `${user?.firstName} ${user?.lastName}`,
              email: user?.email,
              status: ATTENDANCE_STATUSES.UNMARKED,
              date: currentDate,
              timestamp: null,
              reason: '',
              notes: ''
            }];
            setAttendanceData(defaultAttendanceData);
          }
        }
              } catch (error) {
          console.error('Error fetching attendance data:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchData();
      fetchAttendancePercentages();
    }, [courseId, user]);



  const handleBulkAction = () => {
    if (!bulkAction || selectedStudents.size === 0) return;
    
    setAttendanceData(prev => 
      prev.map(record => 
        selectedStudents.has(record.studentId)
          ? { 
              ...record, 
              status: bulkAction,
              timestamp: bulkAction !== ATTENDANCE_STATUSES.UNMARKED ? new Date().toISOString() : null
            }
          : record
      )
    );
    
    setSelectedStudents(new Set());
    setBulkAction('');
  };

  const handleSelectAll = () => {
    if (selectedStudents.size === attendanceData.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(attendanceData.map(record => record.studentId)));
    }
  };

  const handleStudentSelect = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleSaveAttendance = async () => {
    try {
      // Get authentication token
      const token = localStorage.getItem('token');
      if (!token) {
        alert('No authentication token found');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      
      // Save attendance data to backend
      const response = await axios.post(`${API_URL}/api/courses/${courseId}/attendance`, {
        date: selectedDate,
        attendanceData: attendanceData.filter(record => record.status !== ATTENDANCE_STATUSES.UNMARKED)
      }, { headers });
      
      alert('Attendance saved successfully!');
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      alert('Error saving attendance: ' + (error.response?.data?.message || error.message));
    }
  };

  // Auto-save attendance when status changes
  const handleAttendanceChange = async (studentId: string, status: string) => {
    
    // Create updated attendance data with the new status
    const updatedAttendanceData = attendanceData.map(record => 
      record.studentId === studentId 
        ? { 
            ...record, 
            status,
            timestamp: status !== ATTENDANCE_STATUSES.UNMARKED ? new Date().toISOString() : null
          }
        : record
    );
    
    // Update local state immediately for responsive UI
    setAttendanceData(updatedAttendanceData);

    // Auto-save to database
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      
      // Save all attendance data for the current date using the updated data (excluding unmarked)
      const requestData = {
        date: selectedDate,
        attendanceData: updatedAttendanceData
          .filter(record => record.status !== ATTENDANCE_STATUSES.UNMARKED)
          .map(record => ({
            studentId: record.studentId,
            status: record.status,
            timestamp: record.status !== ATTENDANCE_STATUSES.UNMARKED ? record.timestamp || new Date().toISOString() : null,
            reason: record.reason || '',
            notes: record.notes || ''
          }))
      };
      
      
      const response = await axios.post(`${API_URL}/api/courses/${courseId}/attendance`, requestData, { headers });
      
    } catch (error: any) {
      console.error('Error auto-saving attendance:', error);
      // Don't show alert for auto-save errors to avoid spam
    }
  };

  const handleDateChange = async (date: string) => {
    if (!date) return;
    
    setSelectedDate(date);
    
    // Only fetch attendance data if in daily view
    if (viewMode === 'daily') {
      setLoading(true);
      
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No authentication token found');
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };
        
        try {
          const attendanceResponse = await axios.get(`${API_URL}/api/courses/${courseId}/attendance?date=${date}`, { headers });
          const allAttendanceData = attendanceResponse.data || [];
          
          // Filter data based on user role
          if (isInstructor || user?.role === 'admin') {
            // Teachers/Admins see all students
            setAttendanceData(Array.isArray(allAttendanceData) ? allAttendanceData : []);
          } else {
            // Students only see their own attendance
            const studentAttendanceData = (Array.isArray(allAttendanceData) ? allAttendanceData : []).filter((record: any) => 
              record.studentId === user?._id
            );
            setAttendanceData(studentAttendanceData);
          }
        } catch (attendanceError) {
          // If no attendance data exists, create default records
          if (isInstructor || user?.role === 'admin') {
            // For teachers/admins, create records for all students
            const studentsResponse = await axios.get(`${API_URL}/api/courses/${courseId}/students`, { headers });
            const defaultAttendanceData = (studentsResponse.data || []).map((student: any) => ({
              studentId: student._id,
              studentName: `${student.firstName} ${student.lastName}`,
              email: student.email,
              status: ATTENDANCE_STATUSES.UNMARKED,
              date: date,
              timestamp: null,
              reason: '',
              notes: ''
            }));
            setAttendanceData(defaultAttendanceData);
          } else {
            // For students, create only their own record
            const defaultAttendanceData = [{
              studentId: user?._id,
              studentName: `${user?.firstName} ${user?.lastName}`,
              email: user?.email,
              status: ATTENDANCE_STATUSES.UNMARKED,
              date: date,
              timestamp: null,
              reason: '',
              notes: ''
            }];
            setAttendanceData(defaultAttendanceData);
          }
        }
      } catch (error) {
        console.error('Error fetching attendance data:', error);
      } finally {
        setLoading(false);
      }
    }
    // In calendar view, date change just updates selectedDate and the calendar will re-render
  };

  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedStudentsForExport, setSelectedStudentsForExport] = useState<Set<string>>(new Set());
  const [courseData, setCourseData] = useState<any>(null);
  const [exportDateRange, setExportDateRange] = useState({
    startDate: selectedDate,
    endDate: selectedDate
  });

  const assignInstructor = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('No authentication token found');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.patch(`${API_URL}/api/courses/${courseId}/assign-instructor`, {}, { headers });
      
      if (response.data.success) {
        alert('Successfully assigned as instructor!');
        // Refresh course data to update the instructor status
        const token = localStorage.getItem('token');
        if (token) {
          const headers = { Authorization: `Bearer ${token}` };
          const courseResponse = await axios.get(`${API_URL}/api/courses/${courseId}`, { headers });
          setCourseData(courseResponse.data);
          setIsInstructor(true);
        }
      }
    } catch (error: any) {
      console.error('Error assigning instructor:', error);
      alert('Error assigning instructor: ' + (error.response?.data?.message || error.message));
    }
  };

  const exportAttendance = async () => {
    try {
      // Fetch attendance percentages for overall data
      const token = localStorage.getItem('token');
      if (!token) {
        alert('No authentication token found');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch attendance percentages
      const percentagesResponse = await axios.get(`${API_URL}/api/courses/${courseId}/attendance/percentages`, { headers });
      const attendancePercentages = percentagesResponse.data;

      // Create CSV content with course header
      const instructorInfo = courseData?.instructor 
        ? `${courseData.instructor.firstName} ${courseData.instructor.lastName} (${courseData.instructor.email})`
        : 'No Instructor Assigned';
        
      const csvContent = [
        `Course: ${courseData?.title || 'Unknown Course'}`,
        `Instructor: ${instructorInfo}`,
        `Date: ${selectedDate}`,
        '', // Empty line for spacing
        ['Student Name', 'Email', 'Status', 'Overall Attendance %', 'Date', 'Notes'].join(','),
        ...attendanceData.map(record => [
          record.studentName,
          record.email,
          STATUS_CONFIG[record.status].label,
          `${attendancePercentages[record.studentId]?.percentage || 0}%`,
          record.date,
          record.notes || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${(courseData?.title || 'Unknown_Course').replace(/\s+/g, '_')}_${selectedDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting attendance:', error);
      alert('Error exporting attendance data');
    }
  };

  const exportMonthlyAttendance = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        alert('No authentication token found');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      
      // Get the current month's date range
      const currentDate = new Date(selectedDate);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      // Fetch all attendance data for the month
      const allAttendanceData: any[] = [];
      
      for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(year, month, day);
        const dateString = date.toISOString().split('T')[0];
        
        try {
          const response = await axios.get(`${API_URL}/api/courses/${courseId}/attendance?date=${dateString}`, { headers });
          if (response.data && response.data.length > 0) {
            allAttendanceData.push(...response.data);
          }
        } catch (error) {
          // Skip days with no data
        }
      }

      // Fetch attendance percentages
      const percentagesResponse = await axios.get(`${API_URL}/api/courses/${courseId}/attendance/percentages`, { headers });
      const attendancePercentages = percentagesResponse.data;

      // Create CSV content with course header
      const instructorInfo = courseData?.instructor 
        ? `${courseData.instructor.firstName} ${courseData.instructor.lastName} (${courseData.instructor.email})`
        : 'No Instructor Assigned';
        
      const csvContent = [
        `Course: ${courseData?.title || 'Unknown Course'}`,
        `Instructor: ${instructorInfo}`,
        `Period: ${year}-${String(month + 1).padStart(2, '0')}`,
        '', // Empty line for spacing
        ['Date', 'Student Name', 'Email', 'Status', 'Overall Attendance %', 'Notes'].join(','),
        ...allAttendanceData.map(record => [
          record.date,
          record.studentName,
          record.email,
          STATUS_CONFIG[record.status]?.label || record.status,
          `${attendancePercentages[record.studentId]?.percentage || 0}%`,
          record.notes || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${year}_${String(month + 1).padStart(2, '0')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting monthly attendance:', error);
      alert('Error exporting attendance data');
    } finally {
      setLoading(false);
    }
  };

  const exportCustomAttendance = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        alert('No authentication token found');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch attendance percentages
      const percentagesResponse = await axios.get(`${API_URL}/api/courses/${courseId}/attendance/percentages`, { headers });
      const attendancePercentages = percentagesResponse.data;

      // Get all students if none selected
      const studentsToExport = selectedStudentsForExport.size > 0 
        ? Array.from(selectedStudentsForExport)
        : attendanceData.map(record => record.studentId);

      // Fetch attendance data for selected students and date range
      const allAttendanceData: any[] = [];
      
      const startDate = new Date(exportDateRange.startDate);
      const endDate = new Date(exportDateRange.endDate);
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateString = d.toISOString().split('T')[0];
        
        try {
          const response = await axios.get(`${API_URL}/api/courses/${courseId}/attendance?date=${dateString}`, { headers });
          if (response.data && response.data.length > 0) {
            // Filter by selected students
            const filteredData = response.data.filter((record: any) => 
              studentsToExport.includes(record.studentId)
            );
            allAttendanceData.push(...filteredData);
          }
        } catch (error) {
        }
      }

      // Create CSV content with course header
      const instructorInfo = courseData?.instructor 
        ? `${courseData.instructor.firstName} ${courseData.instructor.lastName} (${courseData.instructor.email})`
        : 'No Instructor Assigned';
        
      const csvContent = [
        `Course: ${courseData?.title || 'Unknown Course'}`,
        `Instructor: ${instructorInfo}`,
        `Period: ${exportDateRange.startDate} to ${exportDateRange.endDate}`,
        '', // Empty line for spacing
        ['Date', 'Student Name', 'Email', 'Status', 'Overall Attendance %', 'Notes'].join(','),
        ...allAttendanceData.map(record => [
          record.date,
          record.studentName,
          record.email,
          STATUS_CONFIG[record.status]?.label || record.status,
          `${attendancePercentages[record.studentId]?.percentage || 0}%`,
          record.notes || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_custom_${exportDateRange.startDate}_to_${exportDateRange.endDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting custom attendance:', error);
      alert('Error exporting attendance data');
    } finally {
      setLoading(false);
    }
  };

  const filteredAttendanceData = attendanceData.filter(record => {
    const matchesSearch = record.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         record.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || record.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusCounts = () => {
    const counts = Object.values(ATTENDANCE_STATUSES).reduce((acc, status) => {
      acc[status] = attendanceData.filter(record => record.status === status).length;
      return acc;
    }, {} as Record<string, number>);
    return counts;
  };

  const statusCounts = getStatusCounts();

  // Calculate attendance percentage
  const calculateAttendancePercentage = () => {
    const totalStudents = attendanceData.length;
    if (totalStudents === 0) return 0;
    
    const presentCount = statusCounts[ATTENDANCE_STATUSES.PRESENT] || 0;
    const lateCount = statusCounts[ATTENDANCE_STATUSES.LATE] || 0;
    const excusedCount = statusCounts[ATTENDANCE_STATUSES.EXCUSED] || 0;
    
    // Present + Late + Excused count as attended
    const attendedCount = presentCount + lateCount + excusedCount;
    return Math.round((attendedCount / totalStudents) * 100);
  };

  const attendancePercentage = calculateAttendancePercentage();

  // State for attendance percentages
  const [attendancePercentages, setAttendancePercentages] = useState<Record<string, { percentage: number }>>({});

  // Fetch attendance percentages
  const fetchAttendancePercentages = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API_URL}/api/courses/${courseId}/attendance/percentages`, { headers });
      setAttendancePercentages(response.data);
    } catch (error) {
      console.error('Error fetching attendance percentages:', error);
    }
  };

  // Calculate individual student attendance percentage
  const getStudentAttendancePercentage = (studentId: string) => {
    return attendancePercentages[studentId]?.percentage || 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckSquare className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Attendance</h1>
          {user?.role === 'teacher' && !isInstructor && (
            <button
              onClick={assignInstructor}
              className="px-4 py-2 bg-orange-600 dark:bg-orange-500 text-white rounded-lg hover:bg-orange-700 dark:hover:bg-orange-600 transition-colors font-medium flex items-center gap-2"
            >
              Assign as Instructor
            </button>
          )}
        </div>
      </div>

      {/* View Mode Toggle and Export Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'daily' 
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Daily View
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'calendar' 
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Calendar View
          </button>
        </div>
        <div className="flex gap-2">
          {(isInstructor || user?.role === 'admin') && (
            <>
              <button
                onClick={exportAttendance}
                className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors font-medium flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export Daily CSV
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Custom Export
              </button>
            </>
          )}
        </div>
      </div>

      {/* Date Selector and Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <label htmlFor="attendance-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Date:
              </label>
              <input
                type="date"
                id="attendance-date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          
          {isInstructor && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
              >
                <option value="all">All Status</option>
                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                  <option key={status} value={status}>{config.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {isInstructor && selectedStudents.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              {selectedStudents.size} student(s) selected
            </span>
            <div className="flex items-center gap-2">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
              >
                <option value="">Select action...</option>
                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                  <option key={status} value={status}>Mark as {config.label}</option>
                ))}
              </select>
              <button
                onClick={handleBulkAction}
                disabled={!bulkAction}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conditional Rendering based on View Mode */}
      {viewMode === 'daily' ? (
        <>
          {/* Status Summary - Only show for teachers/admins */}
          {(isInstructor || user?.role === 'admin') && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                const Icon = config.icon;
                return (
                  <div key={status} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border dark:border-gray-700 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Icon className={`h-6 w-6 ${config.color.split(' ')[1]}`} />
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{statusCounts[status]}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{config.label}</div>
                  </div>
                );
              })}
              
              {/* Overall Attendance Percentage Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-green-200 dark:border-green-800 text-center">
                <div className="flex items-center justify-center mb-2">
                  <span className="text-2xl">📊</span>
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{attendancePercentage}%</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Attendance Rate</div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Calendar View */
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Monthly Attendance Calendar</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!selectedDate) {
                      const today = new Date();
                      setSelectedDate(today.toISOString().split('T')[0]);
                      return;
                    }
                    const currentDate = new Date(selectedDate + 'T00:00:00'); // Add time to avoid timezone issues
                    const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
                    setSelectedDate(prevMonth.toISOString().split('T')[0]);
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-900 dark:text-gray-100" />
                </button>
                <span className="text-lg font-medium text-gray-900 dark:text-gray-100 min-w-[150px] text-center">
                  {selectedDate 
                    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    : 'Loading...'}
                </span>
                <button
                  onClick={() => {
                    if (!selectedDate) {
                      const today = new Date();
                      setSelectedDate(today.toISOString().split('T')[0]);
                      return;
                    }
                    const currentDate = new Date(selectedDate + 'T00:00:00'); // Add time to avoid timezone issues
                    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
                    setSelectedDate(nextMonth.toISOString().split('T')[0]);
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <ChevronRight className="h-5 w-5 text-gray-900 dark:text-gray-100" />
                </button>
                {(isInstructor || user?.role === 'admin') && (
                  <button
                    onClick={exportMonthlyAttendance}
                    className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors font-medium flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </button>
                )}
              </div>
            </div>
            
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Day Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                  {day}
                </div>
              ))}
              
              {/* Calendar Days */}
              {generateCalendarDays(selectedDate).map((day, index) => (
                <CalendarDay 
                  key={index}
                  day={day}
                  courseId={courseId}
                  isInstructor={isInstructor}
                  onDateSelect={(date) => setSelectedDate(date)}
                  selectedDate={selectedDate}
                />
              ))}
            </div>
            
            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Attendance Legend</h4>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <CheckCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Present</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <XCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Absent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <AlertCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Late</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <MinusCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Excused</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                  <CheckSquare className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Unmarked</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">No Data</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance List - Only show in Daily View */}
      {viewMode === 'daily' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {(isInstructor || user?.role === 'admin') ? 'Student Attendance' : 'My Attendance'}
                </h2>
              </div>
              {isInstructor && (
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  {selectedStudents.size === attendanceData.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredAttendanceData.map((record) => {
              const statusConfig = STATUS_CONFIG[record.status];
              const StatusIcon = statusConfig.icon;
              
              return (
                <div key={record.studentId} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isInstructor && (
                      <input
                        type="checkbox"
                        checked={selectedStudents.has(record.studentId)}
                        onChange={() => handleStudentSelect(record.studentId)}
                        className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900"
                      />
                    )}
                    <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        {record.studentName.split(' ').map((n: string) => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{record.studentName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{record.email}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400 dark:text-gray-500">Current: {record.status}</p>
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {getStudentAttendancePercentage(record.studentId)}% overall
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {(isInstructor || user?.role === 'admin') ? (
                    <div className="flex items-center gap-2">
                      {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                        const Icon = config.icon;
                        return (
                          <button
                            key={status}
                            onClick={() => handleAttendanceChange(record.studentId, status)}
                            className={`p-2 rounded-lg border transition-colors ${
                              record.status === status 
                                ? config.color 
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                            title={config.label}
                          >
                            <Icon className="h-4 w-4" />
                            {record.status === status && (
                              <span className="text-xs ml-1">{config.shortLabel}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`px-4 py-2 rounded-lg border ${statusConfig.color}`}>
                      <div className="flex items-center gap-2">
                        <StatusIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">{statusConfig.label}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Attendance Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-mark absent after threshold</label>
                <input
                  type="checkbox"
                  checked={attendanceSettings.autoMarkAbsent}
                  onChange={(e) => setAttendanceSettings(prev => ({ ...prev, autoMarkAbsent: e.target.checked }))}
                  className="rounded border-gray-300 dark:border-gray-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Late threshold (minutes)</label>
                <input
                  type="number"
                  value={attendanceSettings.lateThreshold}
                  onChange={(e) => setAttendanceSettings(prev => ({ ...prev, lateThreshold: parseInt(e.target.value) }))}
                  className="mt-1 w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Allow excused absences</label>
                <input
                  type="checkbox"
                  checked={attendanceSettings.allowExcused}
                  onChange={(e) => setAttendanceSettings(prev => ({ ...prev, allowExcused: e.target.checked }))}
                  className="rounded border-gray-300 dark:border-gray-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Require reason for excused</label>
                <input
                  type="checkbox"
                  checked={attendanceSettings.requireReason}
                  onChange={(e) => setAttendanceSettings(prev => ({ ...prev, requireReason: e.target.checked }))}
                  className="rounded border-gray-300 dark:border-gray-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Integrate with grades</label>
                <input
                  type="checkbox"
                  checked={attendanceSettings.gradeIntegration}
                  onChange={(e) => setAttendanceSettings(prev => ({ ...prev, gradeIntegration: e.target.checked }))}
                  className="rounded border-gray-300 dark:border-gray-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Custom Export</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Date Range Selection */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date Range</label>
                <div className="flex gap-2 mt-1">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Start Date</label>
                    <input
                      type="date"
                      value={exportDateRange.startDate}
                      onChange={(e) => setExportDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">End Date</label>
                    <input
                      type="date"
                      value={exportDateRange.endDate}
                      onChange={(e) => setExportDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Student Selection */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Students</label>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                  {attendanceData.map((record) => (
                    <div key={record.studentId} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`student-${record.studentId}`}
                        checked={selectedStudentsForExport.has(record.studentId)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedStudentsForExport);
                          if (e.target.checked) {
                            newSelected.add(record.studentId);
                          } else {
                            newSelected.delete(record.studentId);
                          }
                          setSelectedStudentsForExport(newSelected);
                        }}
                        className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900"
                      />
                      <label htmlFor={`student-${record.studentId}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        {record.studentName} ({record.email})
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Leave all unchecked to export all students
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={exportCustomAttendance}
                disabled={loading}
                className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance; 