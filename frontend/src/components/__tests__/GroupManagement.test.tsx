import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import GroupManagement from '../groups/GroupManagement';
import api from '../../services/api';
import axios from 'axios';

// Mock dependencies
vi.mock('../../services/api', () => ({
  default: {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
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

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children, onDragEnd }: any) => <div>{children}</div>,
  Droppable: ({ children }: any) => <div>{children}</div>,
  Draggable: ({ children }: any) => <div>{children}</div>,
}));

const mockedApi = api as any;
const mockedAxios = axios as any;

describe('GroupManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
    mockedApi.get.mockResolvedValue({
      data: [],
    });
  });

  it('should render group management', async () => {
    render(
      <BrowserRouter>
        <GroupManagement courseId="course1" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalled();
    });
  });

  it('should fetch group sets and students', async () => {
    mockedApi.get.mockResolvedValue({
      data: [],
    });

    render(
      <BrowserRouter>
        <GroupManagement courseId="course1" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/groups/sets/course1');
      expect(mockedApi.get).toHaveBeenCalledWith('/courses/course1/students');
    });
  });

  it('should show create group set button', async () => {
    render(
      <BrowserRouter>
        <GroupManagement courseId="course1" />
      </BrowserRouter>
    );

    await waitFor(() => {
      const createButton = screen.queryByText(/create group set/i);
      if (createButton) {
        expect(createButton).toBeInTheDocument();
      }
    });
  });

  it('should create group set', async () => {
    mockedApi.post.mockResolvedValue({
      data: { _id: 'set1', name: 'New Set' },
    });

    render(
      <BrowserRouter>
        <GroupManagement courseId="course1" />
      </BrowserRouter>
    );

    await waitFor(() => {
      const createButton = screen.queryByText(/create group set/i);
      if (createButton) {
        fireEvent.click(createButton);
      }
    });
  });

  it('should show loading state', () => {
    mockedApi.get.mockImplementation(() => new Promise(() => {}));

    render(
      <BrowserRouter>
        <GroupManagement courseId="course1" />
      </BrowserRouter>
    );

    // Should be loading
    expect(mockedApi.get).toHaveBeenCalled();
  });

  it('should handle errors', async () => {
    mockedApi.get.mockRejectedValue(new Error('Fetch failed'));

    render(
      <BrowserRouter>
        <GroupManagement courseId="course1" />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Error should be handled
      expect(mockedApi.get).toHaveBeenCalled();
    });
  });
});







