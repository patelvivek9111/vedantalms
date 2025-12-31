import React from 'react';
import { getImageUrl } from '../services/api';

interface ProfileImageProps {
  firstName: string;
  lastName: string;
  profilePicture?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-20 h-20 text-3xl'
};

const ProfileImage: React.FC<ProfileImageProps> = ({ 
  firstName, 
  lastName, 
  profilePicture, 
  size = 'md',
  className = ''
}) => {
  const initials = `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  const sizeClass = sizeClasses[size];
  
  return (
    <div className={`relative ${className} ${sizeClass} rounded-full overflow-hidden border-2 border-gray-200 shadow-sm bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center`}>
      {/* Fallback initials - always present as background */}
      <span className={`text-white font-bold absolute inset-0 flex items-center justify-center ${sizeClass.includes('text-sm') ? 'text-sm' : sizeClass.includes('text-base') ? 'text-base' : sizeClass.includes('text-lg') ? 'text-lg' : 'text-3xl'}`}>
        {initials || 'U'}
      </span>
      {/* Profile picture - overlays fallback when loaded */}
      {profilePicture && (
        <img
          src={profilePicture.startsWith('http')
            ? profilePicture
            : getImageUrl(profilePicture)}
          alt={`${firstName} ${lastName}`}
          className={`${sizeClass} rounded-full object-cover relative z-10`}
          onError={(e) => {
            // Hide image on error - fallback will show through
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
    </div>
  );
};

export default ProfileImage;

