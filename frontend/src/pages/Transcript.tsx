import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { API_URL } from '../config';
import DataTable, { Column } from '../components/common/DataTable';
import {
  calculateSGPA,
  calculateCGPA,
  calculateSemesterGPA,
  calculateOverallGPA,
  getIndianGradePoints,
} from '../utils/transcriptGpa';

interface CourseGrade {
  courseId: string;
  courseTitle: string;
  courseCode?: string;
  creditHours?: number;
  finalGrade: number;
  letterGrade: string;
  semester: {
    term: string;
    year: number;
  };
}

interface TranscriptData {
  courses: CourseGrade[];
  gpa?: number;
  totalCredits?: number;
}

interface AllCoursesData {
  courses: CourseGrade[];
  totalCredits: number;
}

const Transcript: React.FC = () => {
  const { user } = useAuth();
  const [selectedSemester, setSelectedSemester] = useState<{ term: string; year: number } | null>(null);
  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(null);
  const [allCoursesData, setAllCoursesData] = useState<AllCoursesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAllCourses, setLoadingAllCourses] = useState(false);
  const [error, setError] = useState('');
  const [availableSemesters, setAvailableSemesters] = useState<Array<{ term: string; year: number }>>([]);

  // Fetch available semesters
  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/reports/semesters`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.data.success) {
          const semesters = response.data.data;
          setAvailableSemesters(semesters);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load semesters');
      }
    };

    fetchSemesters();
  }, []);

  const fetchTranscript = async (semester: { term: string; year: number }) => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/reports/transcript`, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: {
          term: semester.term,
          year: semester.year
        }
      });

      if (response.data.success) {
        setTranscriptData(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load transcript');
    } finally {
      setLoading(false);
    }
  };

  // Fetch transcript when semester is selected
  useEffect(() => {
    if (selectedSemester) {
      fetchTranscript(selectedSemester);
    }
  }, [selectedSemester]);

  const fetchAllCourses = async () => {
    if (availableSemesters.length === 0) return;
    
    setLoadingAllCourses(true);
    try {
      const token = localStorage.getItem('token');
      const allCourses: CourseGrade[] = [];
      
      // Fetch courses from all semesters
      for (const semester of availableSemesters) {
        try {
          const response = await axios.get(`${API_URL}/api/reports/transcript`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
              term: semester.term,
              year: semester.year
            }
          });
          
          if (response.data.success && response.data.data.courses) {
            allCourses.push(...response.data.data.courses);
          }
        } catch (err) {
          }
      }
      
      setAllCoursesData({
        courses: allCourses,
        totalCredits: allCourses.reduce((sum, course) => sum + (course.creditHours || 0), 0)
      });
    } catch (err: any) {
      } finally {
      setLoadingAllCourses(false);
    }
  };

  // Fetch all courses for CGPA calculation
  useEffect(() => {
    if (availableSemesters.length > 0) {
      fetchAllCourses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSemesters.length]);

  const formatGPA = (gpa?: number) => {
    if (gpa === undefined || gpa === null) return 'N/A';
    return gpa.toFixed(2);
  };

  // Define columns for transcript table
  const transcriptColumns = useMemo<Column<CourseGrade>[]>(() => [
    {
      key: 'courseCode',
      label: 'Course Code',
      sortable: true,
      render: (course) => course.courseCode || 'N/A',
      className: 'whitespace-nowrap'
    },
    {
      key: 'courseTitle',
      label: 'Course Title',
      sortable: true,
      className: ''
    },
    {
      key: 'creditHours',
      label: 'Credits',
      sortable: true,
      render: (course) => course.creditHours || 0,
      className: 'whitespace-nowrap text-gray-500 dark:text-gray-400',
      sortFn: (a, b) => (a.creditHours || 0) - (b.creditHours || 0)
    },
    {
      key: 'finalGrade',
      label: 'Grade',
      sortable: true,
      render: (course) => `${course.finalGrade.toFixed(2)}%`,
      className: 'whitespace-nowrap text-gray-500 dark:text-gray-400',
      sortFn: (a, b) => a.finalGrade - b.finalGrade
    },
    {
      key: 'letterGrade',
      label: 'Letter Grade',
      sortable: true,
      render: (course) => (
        <span className="font-medium">{course.letterGrade}</span>
      ),
      className: 'whitespace-nowrap',
      sortFn: (a, b) => {
        const gradeOrder = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
        return gradeOrder.indexOf(a.letterGrade) - gradeOrder.indexOf(b.letterGrade);
      }
    },
    {
      key: 'gradePoints',
      label: 'Grade Points',
      sortable: true,
      render: (course) => getIndianGradePoints(course.letterGrade).toFixed(1),
      className: 'whitespace-nowrap text-gray-500 dark:text-gray-400',
      sortFn: (a, b) => {
        return getIndianGradePoints(a.letterGrade) - getIndianGradePoints(b.letterGrade);
      }
    }
  ], []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-2 sm:px-4 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Unofficial Transcript
            </h1>
            {user && (
              <p className="text-gray-600 dark:text-gray-400">
                {user.firstName} {user.lastName} - {user.email}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
              Unofficial copy for your records. Official grades appear after your institution posts and finalizes the term.
            </p>
          </div>

          {/* Semester Selector */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Semester
            </label>
            <select
              value={selectedSemester ? `${selectedSemester.term}-${selectedSemester.year}` : ''}
              onChange={(e) => {
                const [term, year] = e.target.value.split('-');
                setSelectedSemester({ term, year: parseInt(year) });
              }}
              className="block w-full max-w-xs rounded-md border-gray-300 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-sm"
            >
              <option value="">Select a semester</option>
              {availableSemesters.map((semester, index) => (
                <option key={index} value={`${semester.term}-${semester.year}`}>
                  {semester.term} {semester.year}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Overall CGPA Section - Always visible if data is available */}
          {allCoursesData && allCoursesData.courses.length > 0 && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border-2 border-purple-200 dark:border-purple-800">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                Overall Academic Performance
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 shadow-sm">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">CGPA</p>
                  <p className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {formatGPA(calculateCGPA(allCoursesData.courses))}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">(10-point scale)</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 shadow-sm">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Overall GPA</p>
                  <p className="text-2xl sm:text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                    {formatGPA(calculateOverallGPA(allCoursesData.courses))}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">(4-point scale)</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 shadow-sm">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Total Credits</p>
                  <p className="text-2xl sm:text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                    {allCoursesData.totalCredits}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!selectedSemester && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                Please select a semester to view your transcript
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading transcript...</p>
            </div>
          )}

          {!loading && transcriptData && selectedSemester && (
            <>
              {/* Semester Performance Section */}
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {selectedSemester.term} {selectedSemester.year}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">SGPA</p>
                    <p className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                      {formatGPA(calculateSGPA(transcriptData.courses))}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">(10-point scale)</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Semester GPA</p>
                    <p className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                      {formatGPA(calculateSemesterGPA(transcriptData.courses))}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">(4-point scale)</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Semester Credits</p>
                    <p className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                      {transcriptData.courses.reduce((sum, course) => sum + (course.creditHours || 0), 0)}
                    </p>
                  </div>
                </div>
              </div>

              {transcriptData.courses.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>No courses found for {selectedSemester.term} {selectedSemester.year}</p>
                </div>
              ) : (
                <DataTable<CourseGrade>
                  data={transcriptData.courses}
                  columns={transcriptColumns}
                  keyExtractor={(course) => course.courseId}
                  emptyMessage={`No courses found for ${selectedSemester.term} ${selectedSemester.year}`}
                  pageSize={25}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Transcript;
