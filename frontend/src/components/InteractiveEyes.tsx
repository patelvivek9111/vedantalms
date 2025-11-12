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
  const isPasswordFocusedRef = useRef(isPasswordFocused);
  const peekAnimationRef = useRef(peekAnimation);

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
        const maxMovement = 0.4; // 40% of eye radius for better range
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
    console.log('[Username] Effect running - isUsernameFocused:', isUsernameFocused, 'isPasswordFocused:', isPasswordFocused);
    
    if (!isUsernameFocused || isPasswordFocused) {
      // Only reset if we're not tracking password
      if (!isPasswordFocused) {
        setEyePosition({ x: 0, y: 0.3 }); // Look down when not focused
      }
      return;
    }

    // Create a hidden span element for accurate text measurement
    const measureSpan = document.createElement('span');
    measureSpan.style.visibility = 'hidden';
    measureSpan.style.position = 'absolute';
    measureSpan.style.whiteSpace = 'pre';
    document.body.appendChild(measureSpan);

    const usernameInput = document.getElementById('email-address') as HTMLInputElement;
    if (!usernameInput) {
      console.log('[Username] Input element not found!');
      document.body.removeChild(measureSpan);
      return;
    }
    
    console.log('[Username] Input element found, setting up tracking');

    const updateEyePosition = () => {
      if (!usernameInput) {
        console.log('[Username] No input element');
        return;
      }
      
      // Check if username input is actually focused (more reliable than state)
      if (document.activeElement !== usernameInput) {
        console.log('[Username] Input not focused, activeElement:', document.activeElement?.id);
        return;
      }
      
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (!usernameInput) return;
        
        // Double-check focus state
        if (document.activeElement !== usernameInput) return;
        
        // Get cursor position in input
        // Use selectionEnd as it's more reliable for cursor position
        // selectionStart can be 0 even when cursor is at the end
        const textLength = usernameInput.value.length;
        let cursorPosition = usernameInput.selectionEnd ?? usernameInput.selectionStart ?? textLength;
        
        // If both are 0 or null and there's text, assume cursor is at the end (most common when typing)
        if ((cursorPosition === 0 || cursorPosition === null) && textLength > 0) {
          cursorPosition = textLength;
        }
        
        // Ensure cursor position is within valid range
        cursorPosition = Math.max(0, Math.min(cursorPosition, textLength));
        
        console.log('[Username] Update - cursor:', cursorPosition, 'textLength:', textLength, 'selectionStart:', usernameInput.selectionStart, 'selectionEnd:', usernameInput.selectionEnd, 'value:', usernameInput.value.substring(0, 20) + '...');
        
        // Get computed style to match input font exactly
        const computedStyle = window.getComputedStyle(usernameInput);
        measureSpan.style.font = `${computedStyle.fontStyle} ${computedStyle.fontVariant} ${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;
        measureSpan.style.letterSpacing = computedStyle.letterSpacing;
        measureSpan.style.textTransform = computedStyle.textTransform;
        measureSpan.style.paddingLeft = '0px';
        measureSpan.style.paddingRight = '0px';
        measureSpan.style.boxSizing = 'content-box';
        measureSpan.style.border = 'none';
        measureSpan.style.margin = '0';
        measureSpan.style.whiteSpace = 'pre';
        
        // Calculate actual pixel position of cursor
        const textBeforeCursor = usernameInput.value.substring(0, cursorPosition);
        let textWidth = 0;
        if (textBeforeCursor.length > 0) {
          measureSpan.textContent = textBeforeCursor;
          textWidth = measureSpan.offsetWidth;
        }
        
        // Get input field dimensions
        const inputRect = usernameInput.getBoundingClientRect();
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
        const inputWidth = inputRect.width - paddingLeft - paddingRight;
        
        // Get scroll position - browser auto-scrolls to show cursor when typing
        const scrollLeft = usernameInput.scrollLeft || 0;
        
        console.log('[Username] textWidth:', textWidth, 'inputWidth:', inputWidth, 'scrollLeft:', scrollLeft, 'paddingLeft:', paddingLeft);
        
        // Calculate relative position (0 to 1) based on actual cursor pixel position
        let relativePosition = 0;
        if (inputWidth > 0 && textLength > 0) {
          // Calculate visible text area
          const visibleStart = scrollLeft;
          const visibleEnd = scrollLeft + inputWidth;
          
          // Cursor pixel position relative to start of text
          const cursorPixelPos = textWidth;
          
          console.log('[Username] visibleStart:', visibleStart, 'visibleEnd:', visibleEnd, 'cursorPixelPos:', cursorPixelPos);
          
          // Calculate where cursor appears in the visible area
          // When browser auto-scrolls, cursor is usually at the right edge when at end
          if (cursorPixelPos < visibleStart) {
            // Cursor is to the left of visible area
            relativePosition = 0;
            console.log('[Username] Cursor left of visible area');
          } else if (cursorPixelPos > visibleEnd) {
            // Cursor is to the right of visible area (shouldn't happen with auto-scroll, but handle it)
            relativePosition = 1;
            console.log('[Username] Cursor right of visible area');
          } else {
            // Cursor is in visible area - map to 0-1
            relativePosition = (cursorPixelPos - visibleStart) / inputWidth;
            relativePosition = Math.max(0, Math.min(1, relativePosition));
            console.log('[Username] Cursor in visible area, relativePosition:', relativePosition);
          }
        } else if (textLength === 0) {
          // No text - cursor at start
          relativePosition = 0;
          console.log('[Username] No text, position 0');
        }
        
        // Map to eye position (-0.4 to 0.4) for horizontal movement
        // When cursor is at start (0), eyes look left (-0.4)
        // When cursor is at end (1), eyes look right (0.4)
        // When cursor is in middle (0.5), eyes look center (0)
        const eyeX = (relativePosition - 0.5) * 0.8;
        // Eyes look down since input field is below
        const eyeY = 0.3; // Look down
        
        console.log('[Username] Final - relativePosition:', relativePosition, 'eyeX:', eyeX, 'eyeY:', eyeY);
        
        setEyePosition({ x: eyeX, y: eyeY });
      });
    };

    // Update on various events to catch all cursor movements
    const events = ['keyup', 'keydown', 'keypress', 'click', 'input', 'select', 'focus', 'mousemove', 'scroll'];
    events.forEach(event => {
      usernameInput.addEventListener(event, updateEyePosition);
    });
    
    // Also use interval to catch cursor movements that might be missed
    const intervalId = setInterval(updateEyePosition, 100);
    
    // Initial position
    setTimeout(updateEyePosition, 0);

    return () => {
      events.forEach(event => {
        usernameInput.removeEventListener(event, updateEyePosition);
      });
      clearInterval(intervalId);
      if (document.body.contains(measureSpan)) {
        document.body.removeChild(measureSpan);
      }
    };
  }, [isUsernameFocused, isPasswordFocused, usernameValue]);

  // Track text cursor position in password field (for eye position, only when peeking)
  useEffect(() => {
    if (!isPasswordFocused) {
      return;
    }

    // Create a hidden span element for accurate text measurement
    const measureSpan = document.createElement('span');
    measureSpan.style.visibility = 'hidden';
    measureSpan.style.position = 'absolute';
    measureSpan.style.whiteSpace = 'pre';
    document.body.appendChild(measureSpan);

    const passwordInput = document.getElementById('password') as HTMLInputElement;
    if (!passwordInput) {
      document.body.removeChild(measureSpan);
      return;
    }

    const updateEyePosition = () => {
      if (!passwordInput) return;
      
      // Update eye position as soon as peeking starts (in sync with pupil)
      const currentPeek = peekAnimationRef.current;
      
      if (!currentPeek.isPeeking) {
        return;
      }
      
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (!passwordInput) return;
        
        // Double-check peek state (it might have changed)
        const currentPeek = peekAnimationRef.current;
        
        if (!currentPeek.isPeeking) {
          return;
        }
        
        const eyeOpenAmount = 0.05 + (0.5 - 0.05) * currentPeek.progress;
        console.log('[Password Eye Position] Updating position - progress:', currentPeek.progress.toFixed(2), 'Eye open:', (eyeOpenAmount * 100).toFixed(1) + '%');
        
        // Get cursor position in input
        // Use selectionEnd as it's more reliable for cursor position
        // selectionStart can be 0 even when cursor is at the end
        const textLength = passwordInput.value.length;
        let cursorPosition = passwordInput.selectionEnd ?? passwordInput.selectionStart ?? textLength;
        
        // If both are 0 or null and there's text, assume cursor is at the end (most common when typing)
        if ((cursorPosition === 0 || cursorPosition === null) && textLength > 0) {
          cursorPosition = textLength;
        }
        
        // Ensure cursor position is within valid range
        cursorPosition = Math.max(0, Math.min(cursorPosition, textLength));
        
        // Get computed style to match input font exactly
        const computedStyle = window.getComputedStyle(passwordInput);
        measureSpan.style.font = `${computedStyle.fontStyle} ${computedStyle.fontVariant} ${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;
        measureSpan.style.letterSpacing = computedStyle.letterSpacing;
        measureSpan.style.textTransform = computedStyle.textTransform;
        measureSpan.style.paddingLeft = '0px';
        measureSpan.style.paddingRight = '0px';
        measureSpan.style.boxSizing = 'content-box';
        measureSpan.style.border = 'none';
        measureSpan.style.margin = '0';
        measureSpan.style.whiteSpace = 'pre';
        
        // Calculate actual pixel position of cursor
        // For password fields, use dots (•) to measure since text is hidden
        const maskedText = '•'.repeat(textLength);
        const textBeforeCursor = maskedText.substring(0, cursorPosition);
        let textWidth = 0;
        if (textBeforeCursor.length > 0) {
          measureSpan.textContent = textBeforeCursor;
          textWidth = measureSpan.offsetWidth;
        }
        
        // Get input field dimensions
        const inputRect = passwordInput.getBoundingClientRect();
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
        const inputWidth = inputRect.width - paddingLeft - paddingRight;
        
        // Get scroll position - browser auto-scrolls to show cursor when typing
        const scrollLeft = passwordInput.scrollLeft || 0;
        
        // Calculate relative position (0 to 1) based on actual cursor pixel position
        let relativePosition = 0;
        if (inputWidth > 0 && textLength > 0) {
          // Calculate visible text area
          const visibleStart = scrollLeft;
          const visibleEnd = scrollLeft + inputWidth;
          
          // Cursor pixel position relative to start of text
          const cursorPixelPos = textWidth;
          
          // Calculate where cursor appears in the visible area
          if (cursorPixelPos < visibleStart) {
            relativePosition = 0;
          } else if (cursorPixelPos > visibleEnd) {
            relativePosition = 1;
          } else {
            // Cursor is in visible area - map to 0-1
            relativePosition = (cursorPixelPos - visibleStart) / inputWidth;
            relativePosition = Math.max(0, Math.min(1, relativePosition));
          }
        } else if (textLength === 0) {
          // No text - cursor at start
          relativePosition = 0;
        }
        
        // Map to eye position (-0.4 to 0.4) for horizontal movement
        const eyeX = (relativePosition - 0.5) * 0.8;
        // Eyes look down since input field is below
        const eyeY = 0.3; // Look down
        setEyePosition({ x: eyeX, y: eyeY });
      });
    };

    // Update on various events
    const events = ['keyup', 'keydown', 'keypress', 'click', 'input', 'select', 'focus', 'mousemove', 'scroll'];
    events.forEach(event => {
      passwordInput.addEventListener(event, updateEyePosition);
    });
    
    // Also use interval to catch cursor movements
    const intervalId = setInterval(updateEyePosition, 100);
    
    // Initial position
    setTimeout(updateEyePosition, 0);

    return () => {
      events.forEach(event => {
        passwordInput.removeEventListener(event, updateEyePosition);
      });
      clearInterval(intervalId);
      if (document.body.contains(measureSpan)) {
        document.body.removeChild(measureSpan);
      }
    };
  }, [isPasswordFocused, passwordValue, peekAnimation.isPeeking, peekAnimation.progress]);

  // Blink animation (only when not typing password)
  useEffect(() => {
    if (isPasswordFocused) return;
    
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, 3000);

    return () => clearInterval(blinkInterval);
  }, [isPasswordFocused]);

  // Update refs when state changes
  useEffect(() => {
    isPasswordFocusedRef.current = isPasswordFocused;
  }, [isPasswordFocused]);
  
  useEffect(() => {
    peekAnimationRef.current = peekAnimation;
  }, [peekAnimation]);

  // Password peek animation - one eye opens halfway (no magnifying glass)
  useEffect(() => {
    if (!isPasswordFocused) {
      // Reset peek animation when password field loses focus
      console.log('[Password Peek] Field lost focus, resetting animation');
      setPeekAnimation({ isPeeking: false, eye: 'left', progress: 0 });
      peekCountRef.current = 0;
      if (peekIntervalRef.current) {
        clearTimeout(peekIntervalRef.current);
        peekIntervalRef.current = null;
      }
      return;
    }

    console.log('[Password Peek] Field focused, setting up peek animation');
    
    // Start peek animation loop (3 times)
    peekCountRef.current = 0;
    let animationFrameId: number | null = null;
    let isActive = true;
    
    const startPeek = () => {
      // Check if still focused and haven't exceeded peek count
      if (!isPasswordFocusedRef.current || peekCountRef.current >= 3 || !isActive) {
        console.log('[Password Peek] Stopping peek - focused:', isPasswordFocusedRef.current, 'count:', peekCountRef.current, 'active:', isActive);
        setPeekAnimation({ isPeeking: false, eye: 'left', progress: 0 });
        return;
      }

      console.log('[Password Peek] Starting peek #', peekCountRef.current + 1);
      
      // Always use left eye for peeking
      const eye = 'left';
      
      // Animate eye opening halfway
      const duration = 1000; // 1 second
      const startTime = Date.now();
      
      const animate = () => {
        if (!isActive || !isPasswordFocusedRef.current) {
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
          progress: easedProgress, // Store full progress (0-1) for timing checks
        });
        
        // Log every 10% progress
        if (Math.floor(easedProgress * 10) !== Math.floor((peekAnimationRef.current.progress || 0) * 10)) {
          const eyeOpenAmount = 0.05 + (0.5 - 0.05) * easedProgress;
          const eyeHeight = 20 * 2 * eyeOpenAmount;
          const minEyeOpenForPupil = 0.05; // Pupil appears as soon as eye starts opening
          const pupilVisible = eyeOpenAmount >= minEyeOpenForPupil;
          console.log('[Password Peek] Progress:', (easedProgress * 100).toFixed(1) + '%', 
            '| Eye open:', (eyeOpenAmount * 100).toFixed(1) + '%', 
            '| Eye height:', eyeHeight.toFixed(1), 
            '| Pupil visible:', pupilVisible,
            '| (needs', (minEyeOpenForPupil * 100).toFixed(0) + '%+)');
        }

        if (progress < 1 && isActive && isPasswordFocusedRef.current) {
          animationFrameId = requestAnimationFrame(animate);
        } else {
          console.log('[Password Peek] Animation complete, closing eye');
          // Close eye after peek
          if (isActive && isPasswordFocusedRef.current) {
            setTimeout(() => {
              if (!isActive || !isPasswordFocusedRef.current) return;
              
              setPeekAnimation({ isPeeking: false, eye, progress: 0 });
              peekCountRef.current++;
              console.log('[Password Peek] Eye closed, peek count:', peekCountRef.current);
              
              // Wait 1 second before next peek
              if (peekCountRef.current < 3 && isPasswordFocusedRef.current && isActive) {
                console.log('[Password Peek] Scheduling next peek in 1 second');
                peekIntervalRef.current = setTimeout(startPeek, 1000);
              } else {
                console.log('[Password Peek] All peeks complete');
              }
            }, 300); // Show peek for 300ms
          }
        }
      };
      
      animationFrameId = requestAnimationFrame(animate);
    };

    // Start first peek after 1 second
    console.log('[Password Peek] Scheduling first peek in 1 second');
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

  // Calculate pupil position - always follow eyePosition state for both eyes
  // This ensures pupils follow text cursor in both username and password fields
  const pupilX = eyePosition.x * (eyeRadius - pupilRadius - 2);
  const pupilY = eyePosition.y * (eyeRadius - pupilRadius - 2);

  // Eye close animation - smooth transition
  // For password: fully closed unless peeking
  // For peek: one eye opens halfway
  const getEyeHeight = (isLeft: boolean) => {
    if (isPasswordFocused) {
      if (peekAnimation.isPeeking && peekAnimation.eye === (isLeft ? 'left' : 'right')) {
        // Peeking eye opens halfway
        // progress is 0-1, we want eye to open to 50% height
        // So: closed (0.05) to halfway open (0.5) = 0.05 + (0.5 - 0.05) * progress
        const eyeOpenAmount = 0.05 + (0.5 - 0.05) * peekAnimation.progress;
        const height = eyeRadius * 2 * eyeOpenAmount;
        // Log only occasionally to avoid spam
        if (Math.random() < 0.01) {
          console.log('[Password Eye Height]', isLeft ? 'Left' : 'Right', 
            '| Progress:', peekAnimation.progress.toFixed(2), 
            '| Open amount:', eyeOpenAmount.toFixed(2), 
            '| Height:', height.toFixed(1));
        }
        return height;
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
           {/* Show pupil - for password peek, wait until eye is sufficiently open */}
           {(() => {
             // Calculate eye open amount to determine when pupil should appear
             // Eye opens from 0.05 (5%) to 0.5 (50%) as progress goes from 0 to 1
             const eyeOpenAmount = isPasswordFocused && peekAnimation.isPeeking && peekAnimation.eye === 'left'
               ? 0.05 + (0.5 - 0.05) * peekAnimation.progress
               : 1;
             
             // Pupil should appear as soon as the eye starts opening (in sync)
             // Eye starts at 5% open, so pupil appears immediately when peeking starts
             const minEyeOpenForPupil = 0.05; // Same as starting eye open amount
             const shouldShow = !isPasswordFocused || (peekAnimation.isPeeking && peekAnimation.eye === 'left');
             
             // Calculate opacity based on eye open amount (fade in as eye opens)
             // Opacity scales from 0 to 1 as eye opens from 5% to 50%
             const opacity = isPasswordFocused && peekAnimation.isPeeking && peekAnimation.eye === 'left' 
               ? Math.max(0, Math.min(1, (eyeOpenAmount - 0.05) / (0.5 - 0.05)))
               : 1;
             
             // Log pupil visibility changes
             if (isPasswordFocused && peekAnimation.isPeeking && peekAnimation.eye === 'left') {
               if (Math.random() < 0.05) { // Log occasionally
                 console.log('[Password Pupil] Should show:', shouldShow, 
                   '| Progress:', peekAnimation.progress.toFixed(2), 
                   '| Eye open:', (eyeOpenAmount * 100).toFixed(1) + '%',
                   '| Needs:', (minEyeOpenForPupil * 100).toFixed(0) + '%+',
                   '| Opacity:', opacity.toFixed(2));
               }
             }
             
             // Don't render pupil at all if it shouldn't be visible
             if (!shouldShow || opacity === 0) {
               return null;
             }
             
             return (
               <circle
                 cx={pupilX}
                 cy={pupilY}
                 r={pupilRadius}
                 fill="currentColor"
                 className="text-gray-800 dark:text-gray-200 transition-all duration-300 ease-out"
                 style={{ opacity }}
               />
             );
           })()}
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
              y={-rightEyeHeight / 2}
              width={eyeRadius * 2}
              height={rightEyeHeight}
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

