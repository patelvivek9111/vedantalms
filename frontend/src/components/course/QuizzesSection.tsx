import React from 'react';
import { useNavigate } from 'react-router-dom';
import AssignmentList from '../assignments/AssignmentList';

interface QuizzesSectionProps {
  modules: any[];
  groupAssignments: any[];
  isInstructor: boolean;
  isAdmin: boolean;
  discussionsLoading: boolean;
  user: any;
  studentSubmissions: any[];
  submissionMap: { [key: string]: string };
  course: any;
}

const QuizzesSection: React.FC<QuizzesSectionProps> = ({
  modules,
  groupAssignments,
  isInstructor,
  isAdmin,
  discussionsLoading,
  user,
  studentSubmissions,
  submissionMap,
  course,
}) => {
  const navigate = useNavigate();

  // Gather all assignments and filter for graded quizzes (isGradedQuiz === true)
  const allAssignmentsForQuizzes = modules.flatMap((module: any) => module.assignments || []);
  const allGroupAssignmentsForQuizzes = groupAssignments.map((a: any) => ({
    ...a,
    isGroupAssignment: true,
    totalPoints: a.totalPoints || (Array.isArray(a.questions) ? a.questions.reduce((sum: number, q: any) => sum + (q.points || 0), 0) : 0)
  }));
  
  // Combine all assignments and filter for graded quizzes
  const allItemsForQuizzes = [
    ...allAssignmentsForQuizzes,
    ...allGroupAssignmentsForQuizzes
  ];
  
  const quizzesList = allItemsForQuizzes.filter((item: any) => item.isGradedQuiz === true);
  
  // Deduplicate quizzes by ID
  const seenQuizIds = new Set<string>();
  const deduplicatedQuizzes = quizzesList.filter((item: any) => {
    const id = item._id;
    if (seenQuizIds.has(id)) {
      return false;
    }
    seenQuizIds.add(id);
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-900">
        <div className="space-y-5">
          {(isInstructor || isAdmin) && (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/70">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Create and manage quizzes for this course</p>
              {modules.length > 0 ? (
                <button
                  onClick={() => navigate(`/modules/${modules[0]._id}/assignments/create?isGradedQuiz=true`)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  + Create Quiz
                </button>
              ) : (
                <div className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  Create a module first to add quizzes
                </div>
              )}
            </div>
          )}
          {/* Render quizzes using AssignmentList */}
          {discussionsLoading ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">Loading quizzes...</div>
          ) : modules.length > 0 ? (
            <AssignmentList
              assignments={deduplicatedQuizzes}
              userRole={user?.role}
              studentSubmissions={user?.role === 'student' ? studentSubmissions : undefined}
              studentId={user?._id}
              submissionMap={user?.role === 'student' ? submissionMap : undefined}
              courseId={course?._id}
              isQuizzesView={true}
            />
          ) : (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">No modules available. Please create a module to add quizzes.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizzesSection;






