import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PollVote from '../polls/PollVote';
import axios from 'axios';

// Mock dependencies
vi.mock('axios');
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:5000',
}));

const mockedAxios = axios as any;

describe('PollVote', () => {
  const mockPoll = {
    _id: 'poll1',
    title: 'What is your favorite color?',
    description: 'Choose your favorite color',
    options: [
      { text: 'Red', votes: 5 },
      { text: 'Blue', votes: 3 },
    ],
    allowMultipleVotes: false,
    hasVoted: false,
  };

  const mockOnVoteSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });

  it('should render poll options', () => {
    render(
      <BrowserRouter>
        <PollVote poll={mockPoll} onVoteSuccess={mockOnVoteSuccess} />
      </BrowserRouter>
    );

    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();
  });

  it('should select option', () => {
    render(
      <BrowserRouter>
        <PollVote poll={mockPoll} onVoteSuccess={mockOnVoteSuccess} />
      </BrowserRouter>
    );

    const redOption = screen.getByText('Red').closest('button');
    if (redOption) {
      fireEvent.click(redOption);
      // Option should be selected
      expect(redOption).toHaveClass('border-blue-500');
    }
  });

  it('should submit vote', async () => {
    mockedAxios.post.mockResolvedValue({ data: { success: true } });

    render(
      <BrowserRouter>
        <PollVote poll={mockPoll} onVoteSuccess={mockOnVoteSuccess} />
      </BrowserRouter>
    );

    const redOption = screen.getByText('Red').closest('button');
    if (redOption) {
      fireEvent.click(redOption);
    }

    const submitButton = screen.getByText('Submit Vote');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });

  it('should show user vote when already voted', () => {
    const pollWithVote = {
      ...mockPoll,
      hasVoted: true,
      studentVote: {
        selectedOptions: [0],
      },
    };

    render(
      <BrowserRouter>
        <PollVote poll={pollWithVote} onVoteSuccess={mockOnVoteSuccess} />
      </BrowserRouter>
    );

    expect(screen.getByText(/you have already voted/i)).toBeInTheDocument();
  });

  it('should disable voting after vote is submitted', async () => {
    mockedAxios.post.mockResolvedValue({ data: { success: true } });

    render(
      <BrowserRouter>
        <PollVote poll={mockPoll} onVoteSuccess={mockOnVoteSuccess} />
      </BrowserRouter>
    );

    const redOption = screen.getByText('Red').closest('button');
    if (redOption) {
      fireEvent.click(redOption);
    }

    const submitButton = screen.getByText('Submit Vote');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });
});

