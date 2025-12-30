import React from 'react';

interface StudentSearchSectionProps {
  searchQuery: string;
  searchResults: any[];
  isSearching: boolean;
  searchError: string | null;
  handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleEnroll: (studentId: string) => void;
}

const StudentSearchSection: React.FC<StudentSearchSectionProps> = ({
  searchQuery,
  searchResults,
  isSearching,
  searchError,
  handleSearchChange,
  handleEnroll,
}) => {
  return (
    <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Add Students</h3>
      <div className="relative">
        <input
          type="text"
          placeholder="Search for students by name or email..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
        />
        {isSearching && (
          <div className="absolute right-3 top-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
      
      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search Results</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {searchResults.map((student: any, idx: number) => (
              <div key={`search-${student._id}-${idx}`} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-semibold text-blue-600 dark:text-blue-300">
                    {student.firstName && student.lastName
                      ? `${student.firstName[0]}${student.lastName[0]}`.toUpperCase()
                      : 'U'}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {student.firstName} {student.lastName}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {student.email}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleEnroll(student._id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Search Error */}
      {searchError && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          {searchError}
        </div>
      )}
    </div>
  );
};

export default StudentSearchSection;
























