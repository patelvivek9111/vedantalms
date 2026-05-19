import { useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { fetchGradebookColumnItems } from '../utils/fetchGradebookColumnItems';
import {
  assignGradebookCell,
  discussionGradeToGradebookValue,
  submissionToGradebookValue,
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
  /** When set, called so the UI can avoid showing stale counts while a fetch is in flight or cancelled. */
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
          // Drop stale columns/counts while this run loads (avoids e.g. 14 → 39 flicker when modules or deps change mid-flight)
          setGradebookData({
            students,
            assignments: [],
            grades: {},
          });
        }

        const uniqueInstructor = await fetchGradebookColumnItems(course._id, modules, token);
        if (cancelled) return;

        uniqueInstructor.sort((a: any, b: any) => {
          const getDate = (item: any) => {
            if (item.createdAt) return new Date(item.createdAt).getTime();
            if (item.dueDate) return new Date(item.dueDate).getTime();
            return 0;
          };
          const dateA = getDate(a);
          const dateB = getDate(b);
          if (dateA > 0 && dateB > 0) return dateA - dateB;
          if (dateA > 0 && dateB === 0) return -1;
          if (dateA === 0 && dateB > 0) return 1;
          return 0;
        });

        let grades: { [studentId: string]: { [assignmentId: string]: number | string } } = {};
        for (const assignment of uniqueInstructor) {
          if (cancelled) return;
          if (assignment.isDiscussion) continue;
          const res = await axios.get(`${API_URL}/api/submissions/assignment/${assignment._id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          // Map: { studentId: grade }
          const submissions = Array.isArray(res.data?.data)
            ? res.data.data
            : Array.isArray(res.data) ? res.data : [];
          for (const submission of submissions) {
            if (assignment.isGroupAssignment && submission.group && submission.group.members) {
              submission.group.members.forEach((member: any) => {
                const memberId = member._id || member;
                const value = submissionToGradebookValue(submission, String(memberId));
                assignGradebookCell(grades, String(memberId), assignment._id, value);
              });
            } else if (submission.student) {
              const studentId = submission.student._id || submission.student;
              const value = submissionToGradebookValue(submission);
              assignGradebookCell(grades, String(studentId), assignment._id, value);
            }
          }
        }

        for (const discussion of uniqueInstructor.filter((a: any) => a.isDiscussion)) {
          if (cancelled) return;
          for (const student of students) {
            if (!grades[String(student._id)]) grades[String(student._id)] = {};
            const studentGradeObj = discussion.studentGrades.find(
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
            assignments: uniqueInstructor, 
            grades 
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





