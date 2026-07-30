import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AcceptInvite } from '@/pages/AcceptInvite';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/contexts/TenantContext', () => ({
  useTenant: () => ({
    tenant: { name: 'Test School', brand: { displayName: 'Test School' } },
    loading: false,
  }),
}));

import api from '@/services/api';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

function renderWithToken(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/accept-invite?token=${token}`]}>
      <Routes>
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AcceptInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides editable name fields for roster-verified activation invites', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          email: 'jms1234@lincolnhigh.edu',
          role: 'student',
          pendingPasswordSetup: true,
          firstName: 'John',
          lastName: 'Smith',
        },
      },
    });

    renderWithToken('activation-token');

    await waitFor(() => {
      expect(screen.getByTestId('activation-verified-name')).toHaveTextContent('John Smith');
    });

    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/last name/i)).not.toBeInTheDocument();
    expect(document.getElementById('invite-password')).toBeTruthy();
    expect(screen.getByRole('button', { name: /set password/i })).toBeInTheDocument();
  });

  it('shows editable name fields for normal admin invites', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          email: 'teacher@school.edu',
          role: 'teacher',
          pendingPasswordSetup: false,
        },
      },
    });

    renderWithToken('normal-token');

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.queryByTestId('activation-verified-name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });
});
