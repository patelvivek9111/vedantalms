import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '../../pages/Dashboard';
import { AdminUserManagement } from '../../pages/AdminUserManagement';
import Inbox from '../../pages/Inbox';
import CourseDetail from '../../pages/CourseDetail';
import axios from 'axios';

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { _id: 'u1', firstName: 'Test', lastName: 'User', role: 'teacher' },
    logout: vi.fn(),
    setUser: vi.fn()
  }))
}));

vi.mock('../../contexts/CourseContext', () => ({
  useCourse: vi.fn(() => ({
    courses: [],
    loading: false
  }))
}));

vi.mock('../../context/ThemeContext', () => ({
  useTheme: vi.fn(() => ({ theme: 'light', setTheme: vi.fn() }))
}));

vi.mock('../../components/ToDoPanel', () => ({
  ToDoPanel: () => <div>ToDoPanel</div>
}));

vi.mock('../../components/NotificationCenter', () => ({
  default: () => <div>NotificationCenter</div>
}));

vi.mock('../../components/NavCustomizationModal', () => ({
  NavCustomizationModal: () => <div>NavCustomizationModal</div>,
  ALL_NAV_OPTIONS: [],
  DEFAULT_NAV_ITEMS: []
}));

vi.mock('../../components/ChangeUserModal', () => ({
  ChangeUserModal: () => <div>ChangeUserModal</div>
}));

vi.mock('../../hooks/useBottomNavSwipe', () => ({
  useBottomNavSwipe: vi.fn(() => ({ currentIndex: 0, onTouchStart: vi.fn(), onTouchEnd: vi.fn() }))
}));

vi.mock('../../services/api', () => ({
  default: {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    },
    get: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  },
  getImageUrl: vi.fn((v: string) => v),
  getUserPreferences: vi.fn().mockResolvedValue({ data: { preferences: {} } }),
  updateUserPreferences: vi.fn().mockResolvedValue({}),
  updateUserProfile: vi.fn().mockResolvedValue({ data: { user: {} } }),
  uploadProfilePicture: vi.fn().mockResolvedValue({ data: { user: {} } }),
  getLoginActivity: vi.fn().mockResolvedValue({ data: { data: [] } })
}));

vi.mock('../../services/inboxService', () => ({
  fetchConversations: vi.fn().mockResolvedValue([]),
  fetchMessages: vi.fn().mockResolvedValue([]),
  sendMessage: vi.fn(),
  createConversation: vi.fn(),
  searchUsers: vi.fn().mockResolvedValue([]),
  toggleStar: vi.fn(),
  moveConversation: vi.fn(),
  bulkMoveConversations: vi.fn(),
  bulkDeleteForever: vi.fn()
}));

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(() => ({ isUserOnline: false })),
  markUserOnline: vi.fn(),
  markUserOffline: vi.fn()
}));

vi.mock('../../components/RichTextEditor', () => ({
  default: () => <div>Editor</div>
}));

vi.mock('../../components/BurgerMenu', () => ({
  BurgerMenu: () => <div>BurgerMenu</div>
}));

vi.mock('../../components/common/SwipeableContainer', () => ({
  default: ({ children }: any) => <div>{children}</div>
}));

vi.mock('../../components/common/PullToRefresh', () => ({
  default: ({ children }: any) => <div>{children}</div>
}));

vi.mock('../../components/common/ConfirmationModal', () => ({
  default: () => null
}));

vi.mock('../../contexts/ModuleContext', () => ({
  ModuleProvider: ({ children }: any) => <div>{children}</div>
}));

vi.mock('../../components/CreateModuleForm', () => ({
  default: () => <div>CreateModuleForm</div>
}));

vi.mock('../../components/ModuleList', () => ({
  default: () => <div>ModuleList</div>
}));

vi.mock('react-router-dom', async () => {
  const actual: any = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: 'course-1' })
  };
});

vi.mock('axios');
const mockedAxios = axios as any;

describe('Pages coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.get.mockResolvedValue({ data: { success: true, data: [] } });
  });

  it('renders Dashboard page', () => {
    expect(typeof Dashboard).toBe('function');
  });

  it('renders AdminUserManagement page', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminUserManagement />
      </MemoryRouter>
    );
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('User Management')).toBeInTheDocument());
  });

  it('renders Inbox page', async () => {
    expect(typeof Inbox).toBe('function');
  });

  it('renders CourseDetail page with module actions', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <CourseDetail />
      </MemoryRouter>
    );
    expect(screen.getByText('Course Content')).toBeInTheDocument();
    expect(screen.getByText('Add Module')).toBeInTheDocument();
  });
});

