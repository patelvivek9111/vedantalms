import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../config';
import { format } from 'date-fns';
import logger from '../utils/logger';

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
        logger.error('Error fetching semesters', err);
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
      logger.error('Error fetching transcript', err);
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
          logger.error('Error fetching courses for semester', err, { term: semester.term, year: semester.year });
        }
      }
      
      setAllCoursesData({
        courses: allCourses,
        totalCredits: allCourses.reduce((sum, course) => sum + (course.creditHours || 0), 0)
      });
    } catch (err: any) {
      logger.error('Error fetching all courses', err);
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

  // Convert letter grades to Indian 10-point grade points
  const getIndianGradePoints = (letterGrade: string): number => {
    const gradeMap: { [key: string]: number } = {
      'A+': 10.0,  // O (Outstanding)
      'A': 9.0,    // A+ (Excellent)
      'A-': 8.0,   // A (Very Good)
      'B+': 7.0,   // B+ (Good)
      'B': 6.0,    // B (Above Average)
      'B-': 5.5,   // 
      'C+': 5.0,   // C (Average)
      'C': 4.5,    // 
      'C-': 4.0,   // P (Pass)
      'D+': 3.5,   // 
      'D': 3.0,    // 
      'D-': 2.0,   // 
      'F': 0.0     // F (Fail)
    };
    return gradeMap[letterGrade] ?? 0;
  };

  // Convert letter grades to US 4-point grade points (for GPA)
  const getUSGradePoints = (letterGrade: string): number => {
    const gradeMap: { [key: string]: number } = {
      'A+': 4.0,
      'A': 4.0,
      'A-': 3.7,
      'B+': 3.3,
      'B': 3.0,
      'B-': 2.7,
      'C+': 2.3,
      'C': 2.0,
      'C-': 1.7,
      'D+': 1.3,
      'D': 1.0,
      'D-': 0.7,
      'F': 0.0
    };
    return gradeMap[letterGrade] ?? 0;
  };

  // Calculate SGPA (Semester Grade Point Average) - Indian 10-point system
  const calculateSGPA = (courses: CourseGrade[]): number => {
    if (courses.length === 0) return 0;
    let totalPoints = 0;
    let totalCredits = 0;
    
    courses.forEach(course => {
      const credits = course.creditHours || 0;
      const gradePoints = getIndianGradePoints(course.letterGrade);
      totalPoints += gradePoints * credits;
      totalCredits += credits;
    });

    return totalCredits > 0 ? totalPoints / totalCredits : 0;
  };

  // Calculate CGPA (Cumulative Grade Point Average) - Indian 10-point system
  const calculateCGPA = (courses: CourseGrade[]): number => {
    if (courses.length === 0) return 0;
    let totalPoints = 0;
    let totalCredits = 0;
    
    courses.forEach(course => {
      const credits = course.creditHours || 0;
      const gradePoints = getIndianGradePoints(course.letterGrade);
      totalPoints += gradePoints * credits;
      totalCredits += credits;
    });

    return totalCredits > 0 ? totalPoints / totalCredits : 0;
  };

  // Calculate Semester GPA (US 4-point system)
  const calculateSemesterGPA = (courses: CourseGrade[]): number => {
    if (courses.length === 0) return 0;
    let totalPoints = 0;
    let totalCredits = 0;
    
    courses.forEach(course => {
      const credits = course.creditHours || 0;
      const gradePoints = getUSGradePoints(course.letterGrade);
      totalPoints += gradePoints * credits;
      totalCredits += credits;
    });

    return totalCredits > 0 ? totalPoints / totalCredits : 0;
  };

  // Calculate Overall GPA (US 4-point system) for all courses
  const calculateOverallGPA = (courses: CourseGrade[]): number => {
    if (courses.length === 0) return 0;
    let totalPoints = 0;
    let totalCredits = 0;
    
    courses.forEach(course => {
      const credits = course.creditHours || 0;
      const gradePoints = getUSGradePoints(course.letterGrade);
      totalPoints += gradePoints * credits;
      totalCredits += credits;
    });

    return totalCredits > 0 ? totalPoints / totalCredits : 0;
  };

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
          </div>

          {/* Semester Selector */}
          <div className="mb-4 sm:mb-6">
            <label htmlFor="semester-select" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Semester
            </label>
            <select
              id="semester-select"
              name="semester"
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
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Course Code
                        </th>
                        <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Course Title
                        </th>
                        <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Credits
                        </th>
                        <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Grade
                        </th>
                        <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Letter Grade
                        </th>
                        <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Grade Points
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {transcriptData.courses.map((course, index) => (
                        <tr key={course.courseId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                            {course.courseCode || 'N/A'}
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                            {course.courseTitle}
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            {course.creditHours || 0}
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            {course.finalGrade.toFixed(2)}%
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                            {course.letterGrade}
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            {getIndianGradePoints(course.letterGrade).toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Transcript;
