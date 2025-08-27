// Utility functions for API URL handling
export const getApiBaseUrl = (): string => {
  // In production, use the same domain (no need for full URL)
  if (import.meta.env.PROD) {
    return '/api';
  }
  
  // In development, use localhost:5000
  return '/api';
};

export const getFullApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl();
  
  // If baseUrl already starts with http, it's a full URL
  if (baseUrl.startsWith('http')) {
    return `${baseUrl}${endpoint}`;
  }
  
  // Otherwise, it's a relative path
  return `${baseUrl}${endpoint}`;
};

export const getImageUrl = (imagePath: string): string => {
  if (!imagePath) return '';
  
  // In production, use relative path
  if (import.meta.env.PROD) {
    return imagePath;
  }
  
  // In development, use localhost:5000
  return getImageUrl(imagePath);
};

export const getUploadUrl = (): string => {
  // In production, use the same domain
  if (import.meta.env.PROD) {
    return '/api/upload';
  }
  
  // In development, use localhost:5000
  return '/api/upload';
};
