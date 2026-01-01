import React from 'react';
import { useNavigate } from 'react-router-dom';
import AssignmentList from '../assignments/AssignmentList';

interface CourseQuizzesProps {
  course: {
    _id: string;
    title: string;
  };
  modules: Array<{
    _id: string;
    assignments?: any[];
  }>;
  groupAssignments: any[];
  discussionsLoading: boolean;
  user: {
    _id: string;
    role: string;
  };
  studentSubmissions: any[];
  submissionMap: Record<string, any>;
  isInstructor: boolean;
  isAdmin: boolean;
}

const CourseQuizzes: React.FC<CourseQuizzesProps> = ({
  course,
  modules,
  groupAssignments,
  discussionsLoading,
  user,
  studentSubmissions,
  submissionMap,
  isInstructor,
  isAdmin,
}) => {
  const navigate = useNavigate();

  // Gather all assignments and filter for graded quizzes (isGradedQuiz === true)
  const allAssignmentsForQuizzes = modules.flatMap((module: any) => module.assignments || []);
  const allGroupAssignmentsForQuizzes = groupAssignments.map((a: any) => ({
    ...a,
    isGroupAssignment: true,
    totalPoints: a.totalPoints || (Array.isArray(a.questions) ? a.questions.reduce((sum: number, q: any) => sum + (q.points || 0), 0) : 0),
  }));
  
  // Combine all assignments and filter for graded quizzes
  const allItemsForQuizzes = [
    ...allAssignmentsForQuizzes,
    ...allGroupAssignmentsForQuizzes,
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
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Quizzes</h2>
          {(isInstructor || isAdmin) && (
            <>
              {modules.length > 0 ? (
                <button
                  onClick={() => navigate(`/modules/${modules[0]._id}/assignments/create?isGradedQuiz=true`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Create Quiz
                </button>
              ) : (
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Create a module first to add quizzes
                </div>
              )}
            </>
          )}
        </div>
        {discussionsLoading ? (
          <div className="text-center text-gray-500 py-8">Loading quizzes...</div>
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
          <div className="text-center text-gray-500 py-8">No modules available. Please create a module to add quizzes.</div>
        )}
      </div>
    </div>
  );
};

export default CourseQuizzes;

