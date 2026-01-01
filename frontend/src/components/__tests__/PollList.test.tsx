import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PollList from '../polls/PollList';
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

const mockedUseAuth = useAuth as any;
const mockedAxios = axios as any;

describe('PollList', () => {
  const mockPolls = [
    {
      _id: 'poll1',
      title: 'What is your favorite color?',
      description: 'Choose your favorite',
      options: [
        { text: 'Red', votes: 5 },
        { text: 'Blue', votes: 3 },
      ],
      createdAt: new Date().toISOString(),
      createdBy: {
        firstName: 'John',
        lastName: 'Doe',
      },
      endDate: new Date(Date.now() + 86400000).toISOString(),
      isActive: true,
      resultsVisible: true,
      allowMultipleVotes: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'student' },
    });
  });

  it('should fetch and render polls', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        data: mockPolls,
      },
    });

    render(
      <BrowserRouter>
        <PollList courseId="course1" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(screen.getByText('What is your favorite color?')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should show loading state', () => {
    mockedAxios.get.mockImplementation(() => new Promise(() => {}));

    const { container } = render(
      <BrowserRouter>
        <PollList courseId="course1" />
      </BrowserRouter>
    );

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should show empty state when no polls', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        data: [],
      },
    });

    render(
      <BrowserRouter>
        <PollList courseId="course1" />
      </BrowserRouter>
    );

    await waitFor(() => {
      const emptyText = screen.queryAllByText(/no polls/i);
      expect(emptyText.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('should display poll options', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        data: mockPolls,
      },
    });

    render(
      <BrowserRouter>
        <PollList courseId="course1" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('What is your favorite color?')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

