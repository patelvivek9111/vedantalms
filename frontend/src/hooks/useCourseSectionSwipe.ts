import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeGesture } from './useSwipeGesture';
import { hapticNavigation } from '../utils/hapticFeedback';

interface NavigationItem {
  id: string;
  label: string;
}

interface UseCourseSectionSwipeOptions {
  sections: NavigationItem[];
  activeSection: string;
  courseId: string;
  enabled?: boolean;
}

export const useCourseSectionSwipe = ({
  sections,
  activeSection,
  courseId,
  enabled = true
}: UseCourseSectionSwipeOptions) => {
  const navigate = useNavigate();

  const navigateToSection = useCallback((sectionId: string) => {
    navigate(`/courses/${courseId}/${sectionId}`);
    hapticNavigation();
  }, [navigate, courseId]);

  const handleSwipeLeft = useCallback(() => {
    if (!enabled || sections.length === 0) return;
    
    const currentIndex = sections.findIndex(s => s.id === activeSection);
    if (currentIndex === -1) return;
    
    // Swipe left = next section
    const nextIndex = (currentIndex + 1) % sections.length;
    navigateToSection(sections[nextIndex].id);
  }, [enabled, sections, activeSection, navigateToSection]);

  const handleSwipeRight = useCallback(() => {
    if (!enabled || sections.length === 0) return;
    
    const currentIndex = sections.findIndex(s => s.id === activeSection);
    if (currentIndex === -1) return;
    
    // Swipe right = previous section
    const prevIndex = currentIndex === 0 ? sections.length - 1 : currentIndex - 1;
    navigateToSection(sections[prevIndex].id);
  }, [enabled, sections, activeSection, navigateToSection]);

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 50,
    velocityThreshold: 0.3,
    preventDefault: false, // Don't prevent default to allow scrolling
    enabled: enabled && sections.length > 1 // Only enable if there are multiple sections
  });

  return {
    ...swipeHandlers,
    enabled: enabled && sections.length > 1
  };
};

