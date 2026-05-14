import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import axios from 'axios';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import { useGradebookData } from '../../hooks/useGradebookData';
import { useGradeManagement } from '../../hooks/useGradeManagement';
import { useStudentSubmissions } from '../../hooks/useStudentSubmissions';

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { _id: 'student-1', role: 'student' } }))
}));

vi.mock('../../services/inboxService', () => ({
  fetchConversations: vi.fn().mockResolvedValue([
    {
      unreadCount: 2,
      hasReceivedMessage: true,
      participants: [{ _id: 'student-1', folder: 'inbox' }]
    }
  ])
}));

vi.mock('axios');
const mockedAxios = axios as any;

describe('Hooks coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.get.mockResolvedValue({ data: [] });
    mockedAxios.post.mockResolvedValue({ data: { _id: 'sub-1' } });
    Storage.prototype.getItem = vi.fn(() => 'token');
  });

  it('useUnreadMessages computes unread count for inbox threads', async () => {
    const { result } = renderHook(() => useUnreadMessages());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.unreadCount).toBe(2);
  });

  it('useGradebookData sets data when gradebook section is active for a non-instructor viewer', async () => {
    const setGradebookData = vi.fn();
    mockedAxios.get
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: [] });

    renderHook(() =>
      useGradebookData({
        activeSection: 'gradebook',
        isInstructor: false,
        isAdmin: false,
        course: { _id: 'c1', students: [{ _id: 'student-1' }] },
        modules: [{ title: 'M1', assignments: [{ _id: 'a1', title: 'A1', totalPoints: 10 }] }],
        user: { _id: 'student-1' },
        gradebookRefresh: 0,
        setGradebookData
      } as any)
    );

    await waitFor(() => expect(setGradebookData).toHaveBeenCalled());
  });

  it('useGradeManagement rejects invalid grade input', async () => {
    const setGradeError = vi.fn();
    const setEditingGrade = vi.fn();
    const setSavingGrade = vi.fn();

    const { result } = renderHook(() =>
      useGradeManagement({
        courseId: 'c1',
        submissionMap: { 's1_a1': 'sub1' },
        gradebookData: { students: [], assignments: [{ _id: 'a1', totalPoints: 100 }], grades: {} },
        isInstructor: true,
        isAdmin: false,
        editingValue: '',
        setEditingGrade,
        setEditingValue: vi.fn(),
        setGradeError,
        setSavingGrade,
        setGradebookData: vi.fn(),
        setSubmissionMap: vi.fn()
      } as any)
    );

    await act(async () => {
      await result.current.handleGradeUpdate('s1', 'a1', '-1');
    });

    expect(setGradeError).toHaveBeenCalledWith('Grade must be a valid number');
  });

  it('useStudentSubmissions builds submission map for student', async () => {
    const setStudentSubmissions = vi.fn();
    const setSubmissionMap = vi.fn();
    const setGradebookData = vi.fn();
    mockedAxios.get.mockResolvedValue({
      data: [{ _id: 'sub1', student: 'student-1', assignment: { _id: 'a1' }, grade: 88 }]
    });

    renderHook(() =>
      useStudentSubmissions({
        course: { _id: 'course-1' },
        user: { _id: 'student-1', role: 'student' },
        modules: [],
        setStudentSubmissions,
        setSubmissionMap,
        setGradebookData
      } as any)
    );

    await waitFor(() => expect(setStudentSubmissions).toHaveBeenCalled());
    expect(setSubmissionMap).toHaveBeenCalled();
    expect(setGradebookData).toHaveBeenCalled();
  });
});

