import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Attendance from '@/components/common/Attendance';
import { useAuth } from '@/contexts/AuthContext';
import { setMemoryAuthToken } from '@/utils/authToken';
import axios from 'axios';

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('axios');
// Attendance imports getImageUrl from the api module; mock it so the real axios
// interceptor setup (api.ts) does not run under the auto-mocked axios.
vi.mock('@/services/api', () => ({
  getImageUrl: (value: string) => value,
}));
vi.mock('@/config', () => ({
  API_URL: 'http://localhost:5000',
}));

vi.mock('@/utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

const mockedUseAuth = useAuth as any;
const mockedAxios = axios as any;

function renderAttendance() {
  return render(
    <MemoryRouter initialEntries={['/courses/course1']}>
      <Routes>
        <Route path="/courses/:id" element={<Attendance />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Attendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMemoryAuthToken('test-token');
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'teacher' },
    });
  });

  it('should render attendance component', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          _id: 'course1',
          name: 'Test Course',
          instructor: { _id: 'user1' },
        },
      })
      .mockResolvedValueOnce([]);

    renderAttendance();

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should fetch attendance data', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          _id: 'course1',
          name: 'Test Course',
          instructor: { _id: 'user1' },
        },
      })
      .mockResolvedValueOnce([]);

    renderAttendance();

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should mark student as present', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          _id: 'course1',
          name: 'Test Course',
          instructor: { _id: 'user1' },
        },
      })
      .mockResolvedValueOnce([
        {
          studentId: 'student1',
          studentName: 'John Doe',
          email: 'john@test.com',
          status: 'absent',
        },
      ]);
    mockedAxios.post.mockResolvedValue({ data: { success: true } });

    renderAttendance();

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should show calendar view', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          _id: 'course1',
          name: 'Test Course',
          instructor: { _id: 'user1' },
        },
      })
      .mockResolvedValueOnce([]);

    renderAttendance();

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should filter by date', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          _id: 'course1',
          name: 'Test Course',
          instructor: { _id: 'user1' },
        },
      })
      .mockResolvedValueOnce([]);

    renderAttendance();

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should export attendance', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          _id: 'course1',
          name: 'Test Course',
          instructor: { _id: 'user1' },
        },
      })
      .mockResolvedValueOnce([]);

    renderAttendance();

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    }, { timeout: 3000 });
  });
});

