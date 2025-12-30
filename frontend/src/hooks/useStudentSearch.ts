import { useState, useCallback } from 'react';
import api from '../services/api';

interface UseStudentSearchProps {
  course: any;
}

export const useStudentSearch = ({ course }: UseStudentSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const response = await api.get(`/users/search?name=${encodeURIComponent(query)}&email=${encodeURIComponent(query)}`);
      
      // Ensure data is an array and extract the users from the response
      const users = Array.isArray(response.data.data) ? response.data.data : [];
      
      // Filter out already enrolled students
      const enrolledStudentIds = course?.students?.map((student: any) => student._id) || [];
      const filteredResults = users.filter((user: any) => 
        user.role === 'student' && !enrolledStudentIds.includes(user._id)
      );
      
      setSearchResults(filteredResults);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to search users');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [course?.students]);

  // Debounce function
  const debounce = (func: Function, wait: number) => {
    let timeout: any;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Create debounced search function
  const debouncedSearch = useCallback(
    debounce((query: string) => handleSearch(query), 500),
    [handleSearch]
  );

  // Update search handler to use debounced search
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim()) {
      debouncedSearch(query);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearch]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
  }, []);

  return {
    searchQuery,
    searchResults,
    isSearching,
    searchError,
    handleSearchChange,
    clearSearch,
  };
};






















