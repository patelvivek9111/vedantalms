import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ViewAssignment from '@/components/assignments/ViewAssignment';
import api from '@/services/api';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'assign1' }),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  getImageUrl: (value: string) => value,
}));

vi.mock('@/config', () => ({ API_URL: 'http://localhost:5000' }));
vi.mock('@/services/gradingApi', () => ({ fetchCourseLifecycleStatus: vi.fn().mockResolvedValue({}) }));
vi.mock('@/components/common/ConfirmationModal', () => ({ default: () => null }));
vi.mock('@/components/common/BackButton', () => ({ default: () => <div data-testid="back" /> }));
vi.mock('@/components/files/FilePreviewModal', () => ({ default: () => null }));
vi.mock('@/components/files/FileAttachmentChips', () => ({ default: () => null }));
vi.mock('@/components/assignments/AssignmentFileUploadSection', () => ({
  default: () => <div data-testid="upload-section" />,
}));
vi.mock('@/components/assignments/ScrollableQuizSidebar', () => ({ default: () => null }));
vi.mock('@/components/assignments/MobileQuizChrome', () => ({
  default: () => null,
  MobileQuizProgress: () => null,
  MobileQuestionPills: () => null,
}));
vi.mock('@/components/assignments/TimedQuizStartScreen', () => ({ default: () => null }));

const mockedApi = api as { get: ReturnType<typeof vi.fn> };

const assignmentPayload = {
  _id: 'assign1',
  title: 'Fractions worksheet',
  description: 'Complete all questions.',
  totalPoints: 20,
  course: 'course1',
  isOfflineAssignment: true,
  allowStudentUploads: true,
  questions: [{ _id: 'q1', type: 'text', text: 'Explain your work.', points: 20 }],
  dueDate: new Date(Date.now() + 86_400_000).toISOString(),
  availableFrom: new Date(Date.now() - 86_400_000).toISOString(),
  gradeReleaseMode: 'manual',
  published: true,
};

const studentUser = {
  _id: 'student1',
  role: 'student',
  firstName: 'Sam',
  lastName: 'Student',
};

describe('ViewAssignment — student read path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify(studentUser));
    mockedApi.get.mockImplementation((url: string) => {
      if (url.startsWith('/submissions/student/')) {
        return Promise.reject(new Error('no submission'));
      }
      if (url.startsWith('/assignments/')) {
        return Promise.resolve({ data: assignmentPayload });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('renders assignment title and upload section for offline assignment', async () => {
    render(<ViewAssignment courseId="course1" />);
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: 'Fractions worksheet' }).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByTestId('upload-section').length).toBeGreaterThan(0);
    expect(screen.getByText(/explain your work/i)).toBeInTheDocument();
  });
});
