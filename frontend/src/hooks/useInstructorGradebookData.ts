import { useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { fetchGradebookColumnItems } from '../utils/fetchGradebookColumnItems';
import {
  assignGradebookCell,
  discussionGradeToGradebookValue,
} from '../utils/instructorGradebookGrades';

interface UseInstructorGradebookDataProps {
  activeSection: string;
  isInstructor: boolean;
  isAdmin: boolean;
  course: any;
  modules: any[];
  gradebookRefresh: number;
  setGradebookData: React.Dispatch<React.SetStateAction<{
    students: any[];
    assignments: any[];
    grades: { [studentId: string]: { [assignmentId: string]: number | string } };
  }>>;
  setGradebookLoading?: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useInstructorGradebookData = ({
  activeSection,
  isInstructor,
  isAdmin,
  course,
  modules,
  gradebookRefresh,
  setGradebookData,
  setGradebookLoading,
}: UseInstructorGradebookDataProps) => {
  useEffect(() => {
    let cancelled = false;

    const fetchInstructorGradebookData = async () => {
      if (activeSection !== 'gradebook' || (!isInstructor && !isAdmin)) {
        setGradebookLoading?.(false);
        return;
      }
      try {
        const token = localStorage.getItem('token');
        const students = course?.students || [];
        if (!token || !course?._id) {
          if (!cancelled) {
            setGradebookData({ students, assignments: [], grades: {} });
            setGradebookLoading?.(false);
          }
          return;
        }

        if (!cancelled) {
          setGradebookLoading?.(true);
          setGradebookData({
            students,
            assignments: [],
            grades: {},
          });
        }

        const res = await axios.get(`${API_URL}/api/grades/course/${course._id}/gradebook`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { page: 1, pageSize: 200 },
        });

        if (cancelled) return;

        const payload = res.data?.data || {};
        const assignments = payload.assignments || [];
        const grades = payload.grades || {};

        for (const discussion of assignments.filter((a: any) => a.isDiscussion)) {
          for (const student of students) {
            if (!grades[String(student._id)]) grades[String(student._id)] = {};
            const studentGradeObj = (discussion.studentGrades || []).find(
              (g: any) => g.student && (g.student._id === student._id || g.student === student._id)
            );
            assignGradebookCell(
              grades,
              student._id,
              discussion._id,
              discussionGradeToGradebookValue(studentGradeObj)
            );
          }
        }

        if (!cancelled) {
          setGradebookData({
            students,
            assignments,
            grades,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setGradebookData({ students: [], assignments: [], grades: {} });
        }
      } finally {
        if (!cancelled) setGradebookLoading?.(false);
      }
    };
    void fetchInstructorGradebookData();
    return () => {
      cancelled = true;
    };
  }, [activeSection, isInstructor, isAdmin, course, modules, gradebookRefresh, setGradebookData, setGradebookLoading]);
};
