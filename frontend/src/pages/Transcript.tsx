import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { API_URL } from '../config';
import DataTable, { Column } from '../components/common/DataTable';
import { MobileAppShell } from '../components/common/MobileAppShell';
import { FORM_ERROR } from '../components/common/formStyles';
import {
  calculateSGPA,
  calculateCGPA,
  calculateSemesterGPA,
  calculateOverallGPA,
  getIndianGradePoints,
} from '../utils/transcriptGpa';

const panelClass =
  'overflow-hidden rounded-lg border border-gray-200/90 bg-white dark:border-gray-700 dark:bg-gray-800';
const panelHeaderClass =
  'border-b border-gray-100 px-3 py-2.5 dark:border-gray-700/60 sm:px-4 sm:py-3';

/** Match InboxToolbar control sizing */
const CONTROL =
  'h-10 rounded-lg border border-gray-200 transition-colors dark:border-gray-700';
const CONTROL_TEXT =
  'text-[10px] font-medium text-gray-600 sm:text-[11px] dark:text-gray-300';
const DESKTOP_CONTROL_TEXT = 'lg:text-xs lg:font-medium lg:text-gray-600 dark:lg:text-gray-300';
const CONTROL_FOCUS =
  'focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/40';

function StatCard({
  label,
  value,
  sublabel,
  valueClassName = 'text-gray-900 dark:text-gray-100',
  className = '',
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-gray-200/80 bg-gray-50/80 p-2.5 dark:border-gray-700/60 dark:bg-gray-900/40 sm:p-3 ${className}`}>
      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 sm:text-[11px]">{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums sm:text-lg ${valueClassName}`}>{value}</p>
      {sublabel && <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">{sublabel}</p>}
    </div>
  );
}

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

  const renderCourseMobileCard = (course: CourseGrade) => (
    <div className={`${panelClass} p-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
            {course.courseCode || 'N/A'}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold leading-snug text-gray-900 dark:text-gray-100 sm:text-xs">
            {course.courseTitle}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-bold text-blue-600 dark:text-blue-400 sm:text-xs">
          {course.letterGrade}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {course.creditHours || 0} credits
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {course.finalGrade.toFixed(2)}%
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {getIndianGradePoints(course.letterGrade).toFixed(1)} pts
        </span>
      </div>
    </div>
  );

  return (
    <MobileAppShell title="Transcript" backButtonPath="/dashboard">
      <div className="mx-auto w-full max-w-5xl space-y-2 px-4 py-3 sm:space-y-4 lg:p-6">
        <div className="space-y-1">
          <h1 className="hidden text-2xl font-bold text-gray-900 dark:text-gray-100 lg:block">
            Unofficial Transcript
          </h1>
          {user && (
            <>
              <p className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 sm:text-[11px]">{user.email}</p>
            </>
          )}
          <p className="pt-0.5 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400 sm:text-[11px]">
            Unofficial copy for your records. Official grades appear after your institution posts and finalizes the term.
          </p>
        </div>

        <div className="relative">
          <label htmlFor="transcript-semester-select" className="sr-only">
            Select Semester
          </label>
          <select
            id="transcript-semester-select"
            value={selectedSemester ? `${selectedSemester.term}-${selectedSemester.year}` : ''}
            onChange={(e) => {
              const [term, year] = e.target.value.split('-');
              setSelectedSemester({ term, year: parseInt(year) });
            }}
            className={`compact-control ${CONTROL} ${CONTROL_TEXT} ${DESKTOP_CONTROL_TEXT} ${CONTROL_FOCUS} w-full cursor-pointer appearance-none bg-white px-3 pr-9 dark:bg-gray-800`}
          >
            <option value="">Select a semester</option>
            {availableSemesters.map((semester, index) => (
              <option key={index} value={`${semester.term}-${semester.year}`}>
                {semester.term} {semester.year}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            aria-hidden
          />
        </div>

        {error && (
          <div className={FORM_ERROR}>
            <p>{error}</p>
          </div>
        )}

        {allCoursesData && allCoursesData.courses.length > 0 && (
          <div className={panelClass}>
            <div className={panelHeaderClass}>
              <h2 className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
                Overall Academic Performance
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2 p-2.5 sm:grid-cols-3 sm:gap-3 sm:p-3">
              <StatCard
                label="CGPA"
                value={formatGPA(calculateCGPA(allCoursesData.courses))}
                sublabel="10-point scale"
                valueClassName="text-blue-600 dark:text-blue-400"
              />
              <StatCard
                label="Overall GPA"
                value={formatGPA(calculateOverallGPA(allCoursesData.courses))}
                sublabel="4-point scale"
                valueClassName="text-blue-600 dark:text-blue-400"
              />
              <StatCard
                label="Total Credits"
                value={allCoursesData.totalCredits}
                valueClassName="text-gray-900 dark:text-gray-100"
                className="col-span-2 sm:col-span-1"
              />
            </div>
          </div>
        )}

        {!selectedSemester && (
          <div className={`${panelClass} py-8 text-center`}>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 sm:text-xs">
              Select a semester to view your transcript
            </p>
          </div>
        )}

        {loading && (
          <div className={`${panelClass} py-8 text-center`}>
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400" />
            <p className="mt-2.5 text-[11px] text-gray-500 dark:text-gray-400 sm:text-xs">Loading transcript…</p>
          </div>
        )}

        {!loading && transcriptData && selectedSemester && (
          <>
            <div className={panelClass}>
              <div className={panelHeaderClass}>
                <h2 className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
                  {selectedSemester.term} {selectedSemester.year}
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-2 p-2.5 sm:grid-cols-3 sm:gap-3 sm:p-3">
                <StatCard
                  label="SGPA"
                  value={formatGPA(calculateSGPA(transcriptData.courses))}
                  sublabel="10-point scale"
                  valueClassName="text-blue-600 dark:text-blue-400"
                />
                <StatCard
                  label="Semester GPA"
                  value={formatGPA(calculateSemesterGPA(transcriptData.courses))}
                  sublabel="4-point scale"
                  valueClassName="text-blue-600 dark:text-blue-400"
                />
                <StatCard
                  label="Semester Credits"
                  value={transcriptData.courses.reduce((sum, course) => sum + (course.creditHours || 0), 0)}
                  valueClassName="text-gray-900 dark:text-gray-100"
                  className="col-span-2 sm:col-span-1"
                />
              </div>
            </div>

            {transcriptData.courses.length === 0 ? (
              <div className={`${panelClass} py-8 text-center text-[11px] text-gray-500 dark:text-gray-400 sm:text-xs`}>
                No courses found for {selectedSemester.term} {selectedSemester.year}
              </div>
            ) : (
              <DataTable<CourseGrade>
                data={transcriptData.courses}
                columns={transcriptColumns}
                keyExtractor={(course) => course.courseId}
                emptyMessage={`No courses found for ${selectedSemester.term} ${selectedSemester.year}`}
                pageSize={25}
                renderMobileCard={renderCourseMobileCard}
              />
            )}
          </>
        )}
      </div>
    </MobileAppShell>
  );
};

export default Transcript;
