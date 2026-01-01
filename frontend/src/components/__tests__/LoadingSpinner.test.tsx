import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render with default props', () => {
    const { container } = render(<LoadingSpinner />);
    
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should render with text', () => {
    render(<LoadingSpinner text="Loading data..." />);
    
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('should render different sizes', () => {
    const { rerender } = render(<LoadingSpinner size="sm" />);
    let spinner = document.querySelector('.h-4');
    expect(spinner).toBeInTheDocument();

    rerender(<LoadingSpinner size="md" />);
    spinner = document.querySelector('.h-6');
    expect(spinner).toBeInTheDocument();

    rerender(<LoadingSpinner size="lg" />);
    spinner = document.querySelector('.h-8');
    expect(spinner).toBeInTheDocument();

    rerender(<LoadingSpinner size="xl" />);
    spinner = document.querySelector('.h-12');
    expect(spinner).toBeInTheDocument();
  });

  it('should render different variants', () => {
    const { rerender } = render(<LoadingSpinner variant="default" />);
    let spinner = document.querySelector('.text-gray-600');
    expect(spinner).toBeInTheDocument();

    rerender(<LoadingSpinner variant="primary" />);
    spinner = document.querySelector('.text-blue-600');
    expect(spinner).toBeInTheDocument();

    rerender(<LoadingSpinner variant="white" />);
    spinner = document.querySelector('.text-white');
    expect(spinner).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<LoadingSpinner className="custom-class" />);
    
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('should render white text when variant is white and text is provided', () => {
    render(<LoadingSpinner variant="white" text="Loading..." />);
    
    const text = screen.getByText('Loading...');
    expect(text).toHaveClass('text-white');
  });
});

