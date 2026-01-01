import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfileImage from '../ProfileImage';
import { getImageUrl } from '../../services/api';

// Mock getImageUrl
vi.mock('../../services/api', () => ({
  getImageUrl: vi.fn((url) => `/uploads/${url}`),
}));

describe('ProfileImage', () => {
  it('should render with initials when no profile picture', () => {
    render(<ProfileImage firstName="John" lastName="Doe" />);
    
    const initials = screen.getByText('JD');
    expect(initials).toBeInTheDocument();
  });

  it('should render with profile picture when provided', () => {
    render(
      <ProfileImage
        firstName="John"
        lastName="Doe"
        profilePicture="profile.jpg"
      />
    );

    const image = screen.getByAltText('John Doe');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/uploads/profile.jpg');
  });

  it('should use full URL when profile picture starts with http', () => {
    render(
      <ProfileImage
        firstName="John"
        lastName="Doe"
        profilePicture="https://example.com/profile.jpg"
      />
    );

    const image = screen.getByAltText('John Doe');
    expect(image).toHaveAttribute('src', 'https://example.com/profile.jpg');
  });

  it('should render different sizes', () => {
    const { rerender } = render(
      <ProfileImage firstName="John" lastName="Doe" size="sm" />
    );
    let container = screen.getByText('JD').parentElement;
    expect(container).toHaveClass('w-8', 'h-8');

    rerender(<ProfileImage firstName="John" lastName="Doe" size="md" />);
    container = screen.getByText('JD').parentElement;
    expect(container).toHaveClass('w-10', 'h-10');

    rerender(<ProfileImage firstName="John" lastName="Doe" size="lg" />);
    container = screen.getByText('JD').parentElement;
    expect(container).toHaveClass('w-12', 'h-12');

    rerender(<ProfileImage firstName="John" lastName="Doe" size="xl" />);
    container = screen.getByText('JD').parentElement;
    expect(container).toHaveClass('w-20', 'h-20');
  });

  it('should handle missing first name', () => {
    render(<ProfileImage firstName="" lastName="Doe" />);
    
    const initials = screen.getByText('D');
    expect(initials).toBeInTheDocument();
  });

  it('should handle missing last name', () => {
    render(<ProfileImage firstName="John" lastName="" />);
    
    const initials = screen.getByText('J');
    expect(initials).toBeInTheDocument();
  });

  it('should show default "U" when both names are missing', () => {
    render(<ProfileImage firstName="" lastName="" />);
    
    const initials = screen.getByText('U');
    expect(initials).toBeInTheDocument();
  });

  it('should hide image on error and show fallback', () => {
    render(
      <ProfileImage
        firstName="John"
        lastName="Doe"
        profilePicture="invalid.jpg"
      />
    );

    const image = screen.getByAltText('John Doe');
    const errorEvent = new Event('error');
    
    fireEvent(image, errorEvent);

    // Image should be hidden, fallback should show
    expect(image).toHaveStyle({ display: 'none' });
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ProfileImage
        firstName="John"
        lastName="Doe"
        className="custom-class"
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('should handle single character names', () => {
    render(<ProfileImage firstName="J" lastName="D" />);
    
    const initials = screen.getByText('JD');
    expect(initials).toBeInTheDocument();
  });
});

