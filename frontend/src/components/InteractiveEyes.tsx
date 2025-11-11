import React, { useState, useEffect, useRef } from 'react';

interface InteractiveEyesProps {
  isPasswordFocused: boolean;
  isUsernameFocused: boolean;
  usernameValue: string;
}

export const InteractiveEyes: React.FC<InteractiveEyesProps> = ({
  isPasswordFocused,
  isUsernameFocused,
  usernameValue,
}) => {
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track mouse position for eye following when username is focused
  useEffect(() => {
    if (!isUsernameFocused || isPasswordFocused) {
      // Reset eye position when not following
      setEyePosition({ x: 0, y: 0 });
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Calculate relative position (-1 to 1)
        const relativeX = (e.clientX - centerX) / (rect.width / 2);
        const relativeY = (e.clientY - centerY) / (rect.height / 2);
        
        // Limit eye movement to stay within eye bounds
        const maxMovement = 0.35; // 35% of eye radius
        const clampedX = Math.max(-maxMovement, Math.min(maxMovement, relativeX));
        const clampedY = Math.max(-maxMovement, Math.min(maxMovement, relativeY));
        
        setEyePosition({ x: clampedX, y: clampedY });
      }
    };

    // Also track cursor position in username input field
    const usernameInput = document.getElementById('email-address') as HTMLInputElement;
    if (usernameInput) {
      const handleInputMouseMove = (e: MouseEvent) => {
        const rect = usernameInput.getBoundingClientRect();
        const relativeX = (e.clientX - rect.left) / rect.width;
        // Map input position to eye position (left to right movement)
        const eyeX = (relativeX - 0.5) * 0.7; // Scale down movement
        setEyePosition(prev => ({ x: eyeX, y: prev.y }));
      };
      
      usernameInput.addEventListener('mousemove', handleInputMouseMove);
      window.addEventListener('mousemove', handleMouseMove);

      return () => {
        usernameInput.removeEventListener('mousemove', handleInputMouseMove);
        window.removeEventListener('mousemove', handleMouseMove);
      };
    } else {
      window.addEventListener('mousemove', handleMouseMove);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, [isUsernameFocused, isPasswordFocused]);

  // Blink animation
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      if (!isPasswordFocused) {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
      }
    }, 3000);

    return () => clearInterval(blinkInterval);
  }, [isPasswordFocused]);

  // Reset eye position when password is focused
  useEffect(() => {
    if (isPasswordFocused) {
      setEyePosition({ x: 0, y: 0 });
    }
  }, [isPasswordFocused]);

  const eyeRadius = 20;
  const pupilRadius = 8;
  const eyeSpacing = 60;

  // Calculate pupil position
  const pupilX = eyePosition.x * (eyeRadius - pupilRadius - 2);
  const pupilY = eyePosition.y * (eyeRadius - pupilRadius - 2);

  // Eye close animation - smooth transition
  const eyeCloseProgress = isPasswordFocused ? 1 : 0;
  const eyeHeight = eyeRadius * 2 * (1 - eyeCloseProgress * 0.95);

  return (
    <div
      ref={containerRef}
      className="flex justify-center items-center mb-6 relative"
      style={{ height: '80px' }}
    >
      <svg
        width="140"
        height="80"
        viewBox="0 0 140 80"
        className="transition-all duration-500 ease-in-out"
      >
        {/* Left Eye */}
        <g transform="translate(30, 40)">
          <ellipse
            cx="0"
            cy="0"
            rx={eyeRadius}
            ry={eyeHeight / 2}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-gray-800 dark:text-gray-200 transition-all duration-500 ease-in-out"
          />
          {!isPasswordFocused && (
            <circle
              cx={pupilX}
              cy={pupilY}
              r={pupilRadius}
              fill="currentColor"
              className="text-gray-800 dark:text-gray-200 transition-all duration-300 ease-out"
            />
          )}
          {/* Blink overlay */}
          {isBlinking && !isPasswordFocused && (
            <rect
              x={-eyeRadius}
              y={-eyeHeight / 2}
              width={eyeRadius * 2}
              height={eyeHeight}
              fill="currentColor"
              className="text-gray-800 dark:text-gray-200 animate-pulse"
              style={{ animationDuration: '150ms' }}
            />
          )}
        </g>

        {/* Right Eye */}
        <g transform="translate(110, 40)">
          <ellipse
            cx="0"
            cy="0"
            rx={eyeRadius}
            ry={eyeHeight / 2}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-gray-800 dark:text-gray-200 transition-all duration-500 ease-in-out"
          />
          {!isPasswordFocused && (
            <circle
              cx={pupilX}
              cy={pupilY}
              r={pupilRadius}
              fill="currentColor"
              className="text-gray-800 dark:text-gray-200 transition-all duration-300 ease-out"
            />
          )}
          {/* Blink overlay */}
          {isBlinking && !isPasswordFocused && (
            <rect
              x={-eyeRadius}
              y={-eyeHeight / 2}
              width={eyeRadius * 2}
              height={eyeHeight}
              fill="currentColor"
              className="text-gray-800 dark:text-gray-200 animate-pulse"
              style={{ animationDuration: '150ms' }}
            />
          )}
        </g>
      </svg>
    </div>
  );
};

