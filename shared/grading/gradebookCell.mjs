import {
  resolveSubmissionGradeStatus,
  gradebookCellFromStatus,
} from './gradeStatus.mjs';

export function getGradebookCellForExport(
  student,
  assignment,
  grades,
  submissionMap,
  studentSubmissions = []
) {
  const sid = String(student._id);
  const aid = String(assignment._id);
  const submissionKey = `${sid}_${aid}`;
  const grade =
    grades[sid]?.[aid] ??
    grades[student._id]?.[assignment._id] ??
    grades[sid]?.[assignment._id];

  const hasSubmission = assignment.isDiscussion
    ? Array.isArray(assignment.replies) &&
      assignment.replies.some(
        (r) => r.author && (r.author._id === student._id || r.author === student._id)
      )
    : !!submissionMap[submissionKey];

  let submission = null;
  let submittedAt = null;

  if (assignment.isDiscussion) {
    if (assignment.studentReplyCreatedAt) {
      submittedAt = new Date(assignment.studentReplyCreatedAt);
    } else if (Array.isArray(assignment.replies)) {
      const reply = assignment.replies.find(
        (r) => r.author && (r.author._id === student._id || r.author === student._id)
      );
      if (reply?.createdAt) submittedAt = new Date(reply.createdAt);
    }
  } else {
    const submissionId = submissionMap[submissionKey];
    if (submissionId && Array.isArray(studentSubmissions)) {
      submission = studentSubmissions.find((s) => String(s._id) === String(submissionId));
      if (submission?.submittedAt) submittedAt = new Date(submission.submittedAt);
    }
  }

  const statusResult = resolveSubmissionGradeStatus({
    assignment,
    submission,
    grade,
    now: new Date(),
    perspective: 'instructor',
    studentId: sid,
    hasSubmission,
    submittedAt,
  });

  const cell = gradebookCellFromStatus(statusResult, { grade, assignment });
  const { status, ...exportCell } = cell;
  return exportCell;
}
