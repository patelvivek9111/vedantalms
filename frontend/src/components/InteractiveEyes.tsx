import React, { useState, useEffect, useRef } from 'react';

interface InteractiveEyesProps {
  isPasswordFocused: boolean;
  isUsernameFocused: boolean;
  usernameValue: string;
  passwordValue: string;
}

export const InteractiveEyes: React.FC<InteractiveEyesProps> = ({
  isPasswordFocused,
  isUsernameFocused,
  usernameValue,
  passwordValue,
}) => {
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [peekAnimation, setPeekAnimation] = useState({ isPeeking: false, eye: 'left', progress: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const peekIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const peekCountRef = useRef(0);

  // Track mouse position globally when no input is focused
  useEffect(() => {
    if (isUsernameFocused || isPasswordFocused) {
      return; // Don't follow cursor when input is focused
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

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isUsernameFocused, isPasswordFocused]);

  // Track text cursor position in username field
  useEffect(() => {
    if (!isUsernameFocused || isPasswordFocused) {
      setEyePosition({ x: 0, y: 0 });
      return;
    }

    const usernameInput = document.getElementById('email-address') as HTMLInputElement;
    if (!usernameInput) return;

    const updateEyePosition = () => {
      // Get cursor position in input
      const cursorPosition = usernameInput.selectionStart || 0;
      const textLength = usernameInput.value.length;
      
      // Calculate relative position (0 to 1)
      const relativePosition = textLength > 0 ? cursorPosition / textLength : 0.5;
      
      // Map to eye position (-0.35 to 0.35)
      const eyeX = (relativePosition - 0.5) * 0.7;
      setEyePosition({ x: eyeX, y: 0 });
    };

    // Update on selection change (cursor movement)
    usernameInput.addEventListener('selectionchange', updateEyePosition);
    usernameInput.addEventListener('keyup', updateEyePosition);
    usernameInput.addEventListener('click', updateEyePosition);
    
    // Initial position
    updateEyePosition();

    return () => {
      usernameInput.removeEventListener('selectionchange', updateEyePosition);
      usernameInput.removeEventListener('keyup', updateEyePosition);
      usernameInput.removeEventListener('click', updateEyePosition);
    };
  }, [isUsernameFocused, isPasswordFocused, usernameValue]);

  // Blink animation (only when not typing password)
  useEffect(() => {
    if (isPasswordFocused) return;
    
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, 3000);

    return () => clearInterval(blinkInterval);
  }, [isPasswordFocused]);

  // Password peek animation - one eye opens halfway with magnifying glass
  useEffect(() => {
    if (!isPasswordFocused) {
      // Reset peek animation when password field loses focus
      setPeekAnimation({ isPeeking: false, eye: 'left', progress: 0 });
      peekCountRef.current = 0;
      if (peekIntervalRef.current) {
        clearTimeout(peekIntervalRef.current);
        peekIntervalRef.current = null;
      }
      setEyePosition({ x: 0, y: 0 });
      return;
    }

    // Start peek animation loop (3 times)
    peekCountRef.current = 0;
    let animationFrameId: number | null = null;
    let isActive = true;
    
    const startPeek = () => {
      // Check if still focused and haven't exceeded peek count
      if (!isPasswordFocused || peekCountRef.current >= 3 || !isActive) {
        setPeekAnimation({ isPeeking: false, eye: 'left', progress: 0 });
        return;
      }

      // Determine which eye to peek (alternate)
      const eye = peekCountRef.current % 2 === 0 ? 'left' : 'right';
      
      // Animate eye opening halfway
      const duration = 1000; // 1 second
      const startTime = Date.now();
      
      const animate = () => {
        if (!isActive || !isPasswordFocused) {
          setPeekAnimation({ isPeeking: false, eye, progress: 0 });
          return;
        }

        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease in-out for smooth animation
        const easedProgress = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        setPeekAnimation({
          isPeeking: true,
          eye,
          progress: easedProgress * 0.5, // Halfway open (0.5)
        });

        if (progress < 1 && isActive && isPasswordFocused) {
          animationFrameId = requestAnimationFrame(animate);
        } else {
          // Close eye after peek
          if (isActive && isPasswordFocused) {
            setTimeout(() => {
              if (!isActive || !isPasswordFocused) return;
              
              setPeekAnimation({ isPeeking: false, eye, progress: 0 });
              peekCountRef.current++;
              
              // Wait 1 second before next peek
              if (peekCountRef.current < 3 && isPasswordFocused && isActive) {
                peekIntervalRef.current = setTimeout(startPeek, 1000);
              }
            }, 300); // Show magnifying glass for 300ms
          }
        }
      };
      
      animationFrameId = requestAnimationFrame(animate);
    };

    // Start first peek after 1 second
    peekIntervalRef.current = setTimeout(startPeek, 1000);

    return () => {
      isActive = false;
      if (peekIntervalRef.current) {
        clearTimeout(peekIntervalRef.current);
        peekIntervalRef.current = null;
      }
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      setPeekAnimation({ isPeeking: false, eye: 'left', progress: 0 });
    };
  }, [isPasswordFocused]);

  const eyeRadius = 20;
  const pupilRadius = 8;
  const eyeSpacing = 60;

  // Calculate pupil position
  const pupilX = eyePosition.x * (eyeRadius - pupilRadius - 2);
  const pupilY = eyePosition.y * (eyeRadius - pupilRadius - 2);

  // Eye close animation - smooth transition
  // For password: fully closed unless peeking
  // For peek: one eye opens halfway
  const getEyeHeight = (isLeft: boolean) => {
    if (isPasswordFocused) {
      if (peekAnimation.isPeeking && peekAnimation.eye === (isLeft ? 'left' : 'right')) {
        // Peeking eye opens halfway
        return eyeRadius * 2 * (1 - peekAnimation.progress);
      }
      // Both eyes closed
      return eyeRadius * 2 * 0.05; // Almost closed
    }
    // Normal open
    return eyeRadius * 2;
  };

  const leftEyeHeight = getEyeHeight(true);
  const rightEyeHeight = getEyeHeight(false);

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
            ry={leftEyeHeight / 2}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-gray-800 dark:text-gray-200 transition-all duration-300 ease-in-out"
          />
          {(!isPasswordFocused || (peekAnimation.isPeeking && peekAnimation.eye === 'left')) && (
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
              y={-leftEyeHeight / 2}
              width={eyeRadius * 2}
              height={leftEyeHeight}
              fill="currentColor"
              className="text-gray-800 dark:text-gray-200 animate-pulse"
              style={{ animationDuration: '150ms' }}
            />
          )}
          {/* Magnifying glass for peek */}
          {peekAnimation.isPeeking && peekAnimation.eye === 'left' && peekAnimation.progress > 0.3 && (
            <g className="transition-opacity duration-200">
              {/* Magnifying glass handle */}
              <line
                x1={eyeRadius * 0.6}
                y1={eyeRadius * 0.6}
                x2={eyeRadius * 1.3}
                y2={eyeRadius * 1.3}
                stroke="currentColor"
                strokeWidth="2"
                className="text-gray-600 dark:text-gray-400"
              />
              {/* Magnifying glass circle */}
              <circle
                cx={eyeRadius * 1.1}
                cy={eyeRadius * 1.1}
                r={eyeRadius * 0.4}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-gray-600 dark:text-gray-400"
              />
            </g>
          )}
        </g>

        {/* Right Eye */}
        <g transform="translate(110, 40)">
          <ellipse
            cx="0"
            cy="0"
            rx={eyeRadius}
            ry={rightEyeHeight / 2}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-gray-800 dark:text-gray-200 transition-all duration-300 ease-in-out"
          />
          {(!isPasswordFocused || (peekAnimation.isPeeking && peekAnimation.eye === 'right')) && (
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
              y={-rightEyeHeight / 2}
              width={eyeRadius * 2}
              height={rightEyeHeight}
              fill="currentColor"
              className="text-gray-800 dark:text-gray-200 animate-pulse"
              style={{ animationDuration: '150ms' }}
            />
          )}
          {/* Magnifying glass for peek */}
          {peekAnimation.isPeeking && peekAnimation.eye === 'right' && peekAnimation.progress > 0.3 && (
            <g className="transition-opacity duration-200">
              {/* Magnifying glass handle */}
              <line
                x1={eyeRadius * 0.6}
                y1={eyeRadius * 0.6}
                x2={eyeRadius * 1.3}
                y2={eyeRadius * 1.3}
                stroke="currentColor"
                strokeWidth="2"
                className="text-gray-600 dark:text-gray-400"
              />
              {/* Magnifying glass circle */}
              <circle
                cx={eyeRadius * 1.1}
                cy={eyeRadius * 1.1}
                r={eyeRadius * 0.4}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-gray-600 dark:text-gray-400"
              />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};

