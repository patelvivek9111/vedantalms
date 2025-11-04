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
    <div className={`relative ${className}`}>
      {profilePicture ? (
        <img
          src={profilePicture.startsWith('http')
            ? profilePicture
            : getImageUrl(profilePicture)}
          alt={`${firstName} ${lastName}`}
          className={`${sizeClass} rounded-full object-cover border-2 border-gray-200 shadow-sm`}
          onError={(e) => {
            // Hide the failed image and show fallback
            e.currentTarget.style.display = 'none';
            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
            if (fallback) {
              fallback.style.display = 'flex';
            }
          }}
        />
      ) : null}
      {/* Fallback avatar - always present but hidden when image loads */}
      <div 
        className={`${sizeClass} bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold ${profilePicture ? 'hidden' : 'flex'} shadow-sm`}
        style={{ display: profilePicture ? 'none' : 'flex' }}
      >
        {initials}
      </div>
    </div>
  );
};

export default ProfileImage;

