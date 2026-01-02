import React from 'react';
import { useNavigate } from 'react-router-dom';
import StudentGradeSidebar from '../StudentGradeSidebar';

interface StudentGradesViewProps {
  course: any;
  modules: any[];
  user: any;
  studentGroupAssignments: any[];
  studentDiscussions: any[];
  gradebookData: {
    grades: { [studentId: string]: { [assignmentId: string]: number | string } };
  };
  submissionMap: { [key: string]: string };
  studentSubmissions: any[];
  studentTotalGrade: number | null;
  studentLetterGrade: string | null;
}

const StudentGradesView: React.FC<StudentGradesViewProps> = ({
  course,
  modules,
  user,
  studentGroupAssignments,
  studentDiscussions,
  gradebookData,
  submissionMap,
  studentSubmissions,
  studentTotalGrade,
  studentLetterGrade,
}) => {
  const navigate = useNavigate();

  if (!user) {
    return <div className="text-center py-8 text-gray-500">User not found.</div>;
  }

  // Construct the same assignment list structure as teacher gradebook for consistency
  const studentModuleAssignments = modules.flatMap((module: any) =>
    (module.assignments || []).map((assignment: any) => {
      // Normalize dueDate for all assignment types (future-proof)
      let dueDateRaw = assignment.dueDate || assignment.due_date || assignment.discussionDueDate || null;
      let dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
      return {
        ...assignment,
        moduleTitle: module.title,
        isDiscussion: false,
        dueDate,
      };
    })
  );

  const studentGroupAssignmentsList = studentGroupAssignments.map((assignment: any) => ({
    ...assignment,
    moduleTitle: 'Group Assignments',
    isDiscussion: false
  }));

  const studentGradedDiscussions = studentDiscussions.map((discussion: any) => ({
    _id: discussion._id,
    title: discussion.title,
    totalPoints: discussion.totalPoints,
    group: discussion.group,
    moduleTitle: 'Discussions',
    isDiscussion: true,
    studentGrades: discussion.studentGrades || [],
    dueDate: discussion.dueDate || null,
    hasSubmitted: discussion.hasSubmitted || false,
    replies: discussion.replies || []
  }));

  // Use the same structure as teacher gradebook
  const studentAssignments = [...studentModuleAssignments, ...studentGroupAssignmentsList, ...studentGradedDiscussions];
  
  const studentId = user?._id;
  if (!studentId) {
    return <div className="text-center py-8 text-gray-500">User ID not found.</div>;
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Main Content */}
      <div className="flex-1">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">My Grades</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Track your academic progress</p>
            </div>
          </div>
          {/* Show calculated grade using backend API result */}
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {studentAssignments.map((assignment: any, idx: number) => {
              const submissionKey = `${String(studentId)}_${String(assignment._id)}`;
              let hasSubmission = assignment.isDiscussion 
                ? assignment.hasSubmitted || (Array.isArray(assignment.replies) && assignment.replies.some((r: any) => r.author && (r.author._id === String(studentId) || r.author === String(studentId))))
                : !!submissionMap[submissionKey];
              
              let grade = assignment.isDiscussion
                ? assignment.grade
                : gradebookData.grades[String(studentId)]?.[String(assignment._id)];
              const maxPoints = assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
              const submission = studentSubmissions.find(s => s.assignment && s.assignment._id === assignment._id);
              const feedback = typeof submission?.feedback === 'string' ? submission.feedback : '';
              const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
              const now = new Date();
              let statusCell: React.ReactNode = null;
              let scoreCell: string | number = typeof grade === 'number' ? 
                (Number.isInteger(grade) ? grade.toString() : Number(grade).toFixed(2)) : '-';
              let submittedAt: Date | null = null;
              
              if (assignment.isDiscussion) {
                if (grade === null || grade === undefined) {
                  if (Array.isArray(assignment.studentGrades)) {
                    const studentGradeObj = assignment.studentGrades.find((g: any) => g.student && (g.student._id === String(studentId) || g.student === String(studentId)));
                    if (studentGradeObj && typeof studentGradeObj.grade === 'number') {
                      grade = studentGradeObj.grade;
                      scoreCell = Number.isInteger(grade) ? grade.toString() : Number(grade).toFixed(2);
                      submittedAt = studentGradeObj.gradedAt ? new Date(studentGradeObj.gradedAt) : null;
                      hasSubmission = true;
                    }
                  }
                }
                if (!hasSubmission && Array.isArray(assignment.replies)) {
                  const reply = assignment.replies.find((r: any) => r.author && (r.author._id === studentId || r.author === studentId));
                  if (reply && reply.createdAt) {
                    submittedAt = new Date(reply.createdAt);
                    hasSubmission = true;
                  }
                }
                if (hasSubmission) {
                  if (dueDate && submittedAt && submittedAt > dueDate) {
                    statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Late</span>;
                  } else {
                    statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Submitted</span>;
                  }
                } else if (dueDate && now > dueDate) {
                  statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Missing</span>;
                  scoreCell = '0';
                }
              } else {
                if (!assignment.published) {
                  statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">Not Published</span>;
                  scoreCell = '-';
                } else if (hasSubmission) {
                  if (submission && submission.submittedAt && dueDate && new Date(submission.submittedAt) > dueDate) {
                    statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Late</span>;
                  } else {
                    statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Submitted</span>;
                  }
                } else if (assignment.isOfflineAssignment) {
                  statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Offline</span>;
                  scoreCell = '-';
                } else if (dueDate && now > dueDate) {
                  statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Missing</span>;
                  scoreCell = '0';
                }
              }
              let feedbackForDiscussion = '';
              if (assignment.isDiscussion && Array.isArray(assignment.studentGrades)) {
                const studentGradeObj = assignment.studentGrades.find((g: any) => g.student && (g.student._id === studentId || g.student === studentId));
                if (studentGradeObj && typeof studentGradeObj.feedback === 'string' && studentGradeObj.feedback.trim() !== '') {
                  feedbackForDiscussion = studentGradeObj.feedback;
                }
              }
              
              return (
                <div key={`student-assignment-mobile-${assignment._id}-${idx}`} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base mb-1">{assignment.title}</h3>
                      {assignment.group && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{assignment.group}</div>
                      )}
                    </div>
                    {statusCell}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Due Date</div>
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {assignment.dueDate ? new Date(assignment.dueDate).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Score</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {scoreCell} / {maxPoints}
                      </div>
                    </div>
                  </div>
                  {(feedbackForDiscussion || (hasSubmission && typeof feedback === 'string' && feedback.trim() !== '')) && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors duration-150 text-sm font-medium flex items-center"
                        onClick={() => assignment.isDiscussion ? navigate(`/courses/${course._id}/threads/${assignment._id}`) : navigate(`/assignments/${assignment._id}/view`)}
                      >
                        <span className="mr-2">💬</span>
                        View Feedback
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Due</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Score</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Out of</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {studentAssignments.map((assignment: any, idx: number) => {
                  const submissionKey = `${String(studentId)}_${String(assignment._id)}`;
                  let hasSubmission = assignment.isDiscussion 
                    ? assignment.hasSubmitted || (Array.isArray(assignment.replies) && assignment.replies.some((r: any) => r.author && (r.author._id === String(studentId) || r.author === String(studentId))))
                    : !!submissionMap[submissionKey];
                  
                  let grade = assignment.isDiscussion
                    ? assignment.grade
                    : gradebookData.grades[String(studentId)]?.[String(assignment._id)];
                  const maxPoints = assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
                  const submission = studentSubmissions.find(s => s.assignment && s.assignment._id === assignment._id);
                  const feedback = typeof submission?.feedback === 'string' ? submission.feedback : '';
                  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
                  const now = new Date();
                  let statusCell: React.ReactNode = null;
                  let scoreCell: string | number = typeof grade === 'number' ? 
                    (Number.isInteger(grade) ? grade.toString() : Number(grade).toFixed(2)) : '-';
                  let submittedAt: Date | null = null;
                  
                  if (assignment.isDiscussion) {
                    if (grade === null || grade === undefined) {
                      if (Array.isArray(assignment.studentGrades)) {
                        const studentGradeObj = assignment.studentGrades.find((g: any) => g.student && (g.student._id === String(studentId) || g.student === String(studentId)));
                        if (studentGradeObj && typeof studentGradeObj.grade === 'number') {
                          grade = studentGradeObj.grade;
                          scoreCell = Number.isInteger(grade) ? grade.toString() : Number(grade).toFixed(2);
                          submittedAt = studentGradeObj.gradedAt ? new Date(studentGradeObj.gradedAt) : null;
                          hasSubmission = true;
                        }
                      }
                    }
                    if (!hasSubmission && Array.isArray(assignment.replies)) {
                      const reply = assignment.replies.find((r: any) => r.author && (r.author._id === studentId || r.author === studentId));
                      if (reply && reply.createdAt) {
                        submittedAt = new Date(reply.createdAt);
                        hasSubmission = true;
                      }
                    }
                    if (hasSubmission) {
                      if (dueDate && submittedAt && submittedAt > dueDate) {
                        statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Late</span>;
                      } else {
                        statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Submitted</span>;
                      }
                    } else if (dueDate && now > dueDate) {
                      statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Missing</span>;
                      scoreCell = '0';
                    }
                  } else {
                    if (!assignment.published) {
                      statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">Not Published</span>;
                      scoreCell = '-';
                    } else if (hasSubmission) {
                      if (submission && submission.submittedAt && dueDate && new Date(submission.submittedAt) > dueDate) {
                        statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Late</span>;
                      } else {
                        statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Submitted</span>;
                      }
                    } else if (assignment.isOfflineAssignment) {
                      statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Offline</span>;
                      scoreCell = '-';
                    } else if (dueDate && now > dueDate) {
                      statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Missing</span>;
                      scoreCell = '0';
                    }
                  }
                  let feedbackForDiscussion = '';
                  if (assignment.isDiscussion && Array.isArray(assignment.studentGrades)) {
                    const studentGradeObj = assignment.studentGrades.find((g: any) => g.student && (g.student._id === studentId || g.student === studentId));
                    if (studentGradeObj && typeof studentGradeObj.feedback === 'string' && studentGradeObj.feedback.trim() !== '') {
                      feedbackForDiscussion = studentGradeObj.feedback;
                    }
                  }
                  return (
                    <tr key={`student-assignment-${assignment._id}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{assignment.title}</div>
                        {assignment.group && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{assignment.group}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                        {assignment.dueDate ? new Date(assignment.dueDate).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">{statusCell}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{scoreCell}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-600 dark:text-gray-400">{maxPoints}</td>
                      <td className="px-4 py-3 text-center">
                        {assignment.isDiscussion ? (
                          feedbackForDiscussion && (
                            <button
                              className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors duration-150"
                              title="View feedback"
                              onClick={() => navigate(`/courses/${course._id}/threads/${assignment._id}`)}
                            >
                              <span role="img" aria-label="Comment" className="text-sm">💬</span>
                            </button>
                          )
                        ) : (
                          hasSubmission && typeof feedback === 'string' && feedback.trim() !== '' && (
                            <button
                              className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors duration-150"
                              title="View feedback"
                              onClick={() => navigate(`/assignments/${assignment._id}/view`)}
                            >
                              <span role="img" aria-label="Comment" className="text-sm">💬</span>
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Assignment Group Performance Summary - Separate Card */}
        {course.groups && course.groups.length > 0 && (
          <div className="mt-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-blue-100 dark:bg-blue-900 rounded-lg p-2">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Performance by Assignment Group</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Your scores broken down by weighted categories</p>
                </div>
              </div>
              
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {(course.groups || []).map((group: any, idx: number) => {
                  const groupAssignments = studentAssignments.filter((assignment: any) => assignment.group === group.name);
                  let totalEarned = 0;
                  let totalPossible = 0;
                  let gradedAssignments = 0;
                  
                  groupAssignments.forEach((assignment: any) => {
                    const maxPoints = assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
                    let grade = assignment.isDiscussion
                      ? assignment.grade
                      : gradebookData.grades[String(studentId)]?.[String(assignment._id)];
                    
                    if (assignment.isDiscussion && (grade === null || grade === undefined)) {
                      if (Array.isArray(assignment.studentGrades)) {
                        const studentGradeObj = assignment.studentGrades.find((g: any) => g.student && (g.student._id === String(studentId) || g.student === String(studentId)));
                        if (studentGradeObj && typeof studentGradeObj.grade === 'number') {
                          grade = studentGradeObj.grade;
                        }
                      }
                    }
                    
                    if (typeof grade === 'number') {
                      totalEarned += grade;
                      totalPossible += maxPoints;
                      gradedAssignments++;
                    } else {
                      const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
                      const now = new Date();
                      const submissionKey = `${String(studentId)}_${String(assignment._id)}`;
                      const hasSubmission = assignment.isDiscussion 
                        ? assignment.hasSubmitted || (Array.isArray(assignment.replies) && assignment.replies.some((r: any) => r.author && (r.author._id === String(studentId) || r.author === String(studentId))))
                        : !!submissionMap[submissionKey];
                      
                      if (dueDate && now > dueDate && !hasSubmission) {
                        totalEarned += 0;
                        totalPossible += maxPoints;
                        gradedAssignments++;
                      }
                    }
                  });
                  
                  const percentage = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;
                  const percentageColor = percentage >= 90 ? 'text-green-600 dark:text-green-400' : 
                                       percentage >= 80 ? 'text-blue-600 dark:text-blue-400' : 
                                       percentage >= 70 ? 'text-yellow-600 dark:text-yellow-400' : 
                                       'text-red-600 dark:text-red-400';
                  
                  return (
                    <div key={idx} className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{group.name}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Assignments</div>
                          <div className="text-sm text-gray-900 dark:text-gray-100">{gradedAssignments}/{groupAssignments.length}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Weight</div>
                          <div className="text-sm text-gray-900 dark:text-gray-100">{group.weight}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Points Earned</div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{totalEarned.toFixed(1)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Points</div>
                          <div className="text-sm text-gray-900 dark:text-gray-100">{totalPossible.toFixed(1)}</div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Percentage</div>
                        <div className={`text-lg font-bold ${percentageColor}`}>
                          {totalPossible > 0 ? percentage.toFixed(1) : '-'}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Assignment Group</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Assignments</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Points Earned</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Total Points</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Percentage</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {(course.groups || []).map((group: any, idx: number) => {
                      const groupAssignments = studentAssignments.filter((assignment: any) => assignment.group === group.name);
                      let totalEarned = 0;
                      let totalPossible = 0;
                      let gradedAssignments = 0;
                      
                      groupAssignments.forEach((assignment: any) => {
                        const maxPoints = assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
                        let grade = assignment.isDiscussion
                          ? assignment.grade
                          : gradebookData.grades[String(studentId)]?.[String(assignment._id)];
                        
                        if (assignment.isDiscussion && (grade === null || grade === undefined)) {
                          if (Array.isArray(assignment.studentGrades)) {
                            const studentGradeObj = assignment.studentGrades.find((g: any) => g.student && (g.student._id === String(studentId) || g.student === String(studentId)));
                            if (studentGradeObj && typeof studentGradeObj.grade === 'number') {
                              grade = studentGradeObj.grade;
                            }
                          }
                        }
                        
                        if (typeof grade === 'number') {
                          totalEarned += grade;
                          totalPossible += maxPoints;
                          gradedAssignments++;
                        } else {
                          const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
                          const now = new Date();
                          const submissionKey = `${String(studentId)}_${String(assignment._id)}`;
                          const hasSubmission = assignment.isDiscussion 
                            ? assignment.hasSubmitted || (Array.isArray(assignment.replies) && assignment.replies.some((r: any) => r.author && (r.author._id === String(studentId) || r.author === String(studentId))))
                            : !!submissionMap[submissionKey];
                          
                          if (dueDate && now > dueDate && !hasSubmission) {
                            totalEarned += 0;
                            totalPossible += maxPoints;
                            gradedAssignments++;
                          }
                        }
                      });
                      
                      const percentage = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;
                      const percentageColor = percentage >= 90 ? 'text-green-600 dark:text-green-400' : 
                                           percentage >= 80 ? 'text-blue-600 dark:text-blue-400' : 
                                           percentage >= 70 ? 'text-yellow-600 dark:text-yellow-400' : 
                                           'text-red-600 dark:text-red-400';
                      
                      return (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{group.name}</div>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                            {gradedAssignments}/{groupAssignments.length}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{totalEarned.toFixed(1)}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                            {totalPossible.toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-semibold ${percentageColor}`}>
                              {totalPossible > 0 ? percentage.toFixed(1) : '-'}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                            {group.weight}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar (only) */}
      <StudentGradeSidebar
        course={course}
        studentId={studentId}
        grades={gradebookData.grades}
        assignments={studentAssignments}
        submissionMap={submissionMap}
        studentSubmissions={studentSubmissions}
        backendTotalGrade={studentTotalGrade}
        backendLetterGrade={studentLetterGrade}
      />
    </div>
  );
};

export default StudentGradesView;


