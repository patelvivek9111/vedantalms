import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PollForm from '../polls/PollForm';
import axios from 'axios';

// Mock dependencies
vi.mock('axios');
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:5000',
}));

const mockedAxios = axios as any;

describe('PollForm', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render poll form', () => {
    render(
      <BrowserRouter>
        <PollForm courseId="course1" onClose={mockOnClose} onSuccess={mockOnSuccess} />
      </BrowserRouter>
    );

    expect(screen.getByText('Create New Poll')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g., what type of content/i)).toBeInTheDocument();
  });

  it('should add poll options', () => {
    render(
      <BrowserRouter>
        <PollForm courseId="course1" onClose={mockOnClose} onSuccess={mockOnSuccess} />
      </BrowserRouter>
    );

    const addOptionButton = screen.getByText(/add option/i);
    fireEvent.click(addOptionButton);

    // Should add new option input
    const optionInputs = screen.getAllByPlaceholderText(/option/i);
    expect(optionInputs.length).toBeGreaterThan(2);
  });

  it('should remove poll options', () => {
    render(
      <BrowserRouter>
        <PollForm courseId="course1" onClose={mockOnClose} onSuccess={mockOnSuccess} />
      </BrowserRouter>
    );

    // Add an option first
    const addOptionButton = screen.getByText(/add option/i);
    fireEvent.click(addOptionButton);

    // Then try to remove - look for button with title "Remove option"
    const removeButtons = screen.getAllByTitle('Remove option');
    expect(removeButtons.length).toBeGreaterThan(0);
    if (removeButtons.length > 0) {
      fireEvent.click(removeButtons[0]);
      // After removal, there should be 2 options left (minimum)
      const optionInputs = screen.getAllByPlaceholderText(/option/i);
      expect(optionInputs.length).toBe(2);
    }
  });

  it('should submit poll', async () => {
    mockedAxios.post.mockResolvedValue({ data: { success: true } });
    localStorage.setItem('token', 'test-token');

    render(
      <BrowserRouter>
        <PollForm courseId="course1" onClose={mockOnClose} onSuccess={mockOnSuccess} />
      </BrowserRouter>
    );

    const titleInput = screen.getByPlaceholderText(/e.g., what type of content/i);
    fireEvent.change(titleInput, { target: { value: 'Test Question' } });

    // Set end date - find the date input by id
    const dateInput = document.querySelector('input[type="date"]#dateInput') as HTMLInputElement;
    if (dateInput) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      fireEvent.change(dateInput, { target: { value: futureDate.toISOString().split('T')[0] } });
    }

    // Fill in at least 2 options
    const optionInputs = screen.getAllByPlaceholderText(/option/i);
    fireEvent.change(optionInputs[0], { target: { value: 'Option 1' } });
    fireEvent.change(optionInputs[1], { target: { value: 'Option 2' } });

    const submitButton = screen.getByText(/create poll/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should validate required fields', async () => {
    render(
      <BrowserRouter>
        <PollForm courseId="course1" onClose={mockOnClose} onSuccess={mockOnSuccess} />
      </BrowserRouter>
    );

    const submitButton = screen.getByText(/create poll/i);
    fireEvent.click(submitButton);

    // Should not submit without required fields
    await waitFor(() => {
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  it('should close form', () => {
    render(
      <BrowserRouter>
        <PollForm courseId="course1" onClose={mockOnClose} onSuccess={mockOnSuccess} />
      </BrowserRouter>
    );

    const closeButton = screen.queryByText(/close/i) || screen.queryByLabelText(/close/i);
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });
});

