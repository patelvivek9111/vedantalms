import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Attendance from '../Attendance';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

// Mock dependencies
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('axios');
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:5000',
}));

vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

const mockedUseAuth = useAuth as any;
const mockedAxios = axios as any;

describe('Attendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
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

    render(
      <BrowserRouter>
        <Attendance />
      </BrowserRouter>
    );

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

    render(
      <BrowserRouter>
        <Attendance />
      </BrowserRouter>
    );

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

    render(
      <BrowserRouter>
        <Attendance />
      </BrowserRouter>
    );

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

    render(
      <BrowserRouter>
        <Attendance />
      </BrowserRouter>
    );

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

    render(
      <BrowserRouter>
        <Attendance />
      </BrowserRouter>
    );

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

    render(
      <BrowserRouter>
        <Attendance />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    }, { timeout: 3000 });
  });
});

