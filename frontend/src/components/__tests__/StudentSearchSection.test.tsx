import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StudentSearchSection from '../course/StudentSearchSection';

describe('StudentSearchSection', () => {
  const mockHandleSearchChange = vi.fn();
  const mockHandleEnroll = vi.fn();

  const mockSearchResults = [
    {
      _id: 'student1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    },
    {
      _id: 'student2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render search input', () => {
    render(
      <StudentSearchSection
        searchQuery=""
        searchResults={[]}
        isSearching={false}
        searchError={null}
        handleSearchChange={mockHandleSearchChange}
        handleEnroll={mockHandleEnroll}
      />
    );

    expect(screen.getByPlaceholderText(/search for students/i)).toBeInTheDocument();
  });

  it('should call handleSearchChange on input change', () => {
    render(
      <StudentSearchSection
        searchQuery=""
        searchResults={[]}
        isSearching={false}
        searchError={null}
        handleSearchChange={mockHandleSearchChange}
        handleEnroll={mockHandleEnroll}
      />
    );

    const input = screen.getByPlaceholderText(/search for students/i);
    fireEvent.change(input, { target: { value: 'John' } });

    expect(mockHandleSearchChange).toHaveBeenCalled();
  });

  it('should display search results', () => {
    render(
      <StudentSearchSection
        searchQuery="John"
        searchResults={mockSearchResults}
        isSearching={false}
        searchError={null}
        handleSearchChange={mockHandleSearchChange}
        handleEnroll={mockHandleEnroll}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('should show loading spinner when searching', () => {
    render(
      <StudentSearchSection
        searchQuery="John"
        searchResults={[]}
        isSearching={true}
        searchError={null}
        handleSearchChange={mockHandleSearchChange}
        handleEnroll={mockHandleEnroll}
      />
    );

    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should enroll student when enroll button is clicked', () => {
    render(
      <StudentSearchSection
        searchQuery="John"
        searchResults={mockSearchResults}
        isSearching={false}
        searchError={null}
        handleSearchChange={mockHandleSearchChange}
        handleEnroll={mockHandleEnroll}
      />
    );

    // Find the button associated with the first student (John Doe)
    const johnDoeElement = screen.getByText('John Doe');
    const parentDiv = johnDoeElement.closest('div.flex.items-center.justify-between');
    const addButton = parentDiv?.querySelector('button');
    
    expect(addButton).toBeInTheDocument();
    if (addButton) {
      fireEvent.click(addButton);
      expect(mockHandleEnroll).toHaveBeenCalledWith('student1');
    }
  });

  it('should display student initials', () => {
    render(
      <StudentSearchSection
        searchQuery="John"
        searchResults={mockSearchResults}
        isSearching={false}
        searchError={null}
        handleSearchChange={mockHandleSearchChange}
        handleEnroll={mockHandleEnroll}
      />
    );

    expect(screen.getByText('JD')).toBeInTheDocument();
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('should show error message', () => {
    render(
      <StudentSearchSection
        searchQuery="John"
        searchResults={[]}
        isSearching={false}
        searchError="Search failed"
        handleSearchChange={mockHandleSearchChange}
        handleEnroll={mockHandleEnroll}
      />
    );

    expect(screen.getByText('Search failed')).toBeInTheDocument();
  });

  it('should not show results when search query is empty', () => {
    render(
      <StudentSearchSection
        searchQuery=""
        searchResults={[]}
        isSearching={false}
        searchError={null}
        handleSearchChange={mockHandleSearchChange}
        handleEnroll={mockHandleEnroll}
      />
    );

    expect(screen.queryByText('Search Results')).not.toBeInTheDocument();
  });
});

