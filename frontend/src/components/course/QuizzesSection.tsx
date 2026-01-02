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
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Quizzes</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">View and manage course quizzes</p>
          </div>
          {(isInstructor || isAdmin) && (
            <>
              {modules.length > 0 ? (
                <button
                  onClick={() => navigate(`/modules/${modules[0]._id}/assignments/create?isGradedQuiz=true`)}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm text-sm sm:text-base"
                >
                  <span className="text-base sm:text-lg">+</span>
                  <span>Create Quiz</span>
                </button>
              ) : (
                <div className="w-full sm:w-auto text-xs sm:text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-3 sm:px-4 py-2 rounded-md text-center sm:text-left">
                  Create a module first to add quizzes
                </div>
              )}
            </>
          )}
        </div>
        {/* Render quizzes using AssignmentList */}
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

export default QuizzesSection;


