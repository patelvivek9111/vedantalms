import React, { useState, useEffect, useRef } from 'react';

interface InteractiveEyesProps {
  isPasswordFocused: boolean;
  isUsernameFocused: boolean;
  usernameValue: string;
  passwordValue: string;
  hasError?: boolean;
  isLoading?: boolean;
}

export const InteractiveEyes: React.FC<InteractiveEyesProps> = ({
  isPasswordFocused,
  isUsernameFocused,
  usernameValue,
  passwordValue,
  hasError = false,
  isLoading = false,
}) => {
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [peekAnimation, setPeekAnimation] = useState({ isPeeking: false, eye: 'left', progress: 0 });
  const [isWinking, setIsWinking] = useState(false);
  const [winkingEye, setWinkingEye] = useState<'left' | 'right' | null>(null);
  const [isSurprised, setIsSurprised] = useState(false);
  const [isConfused, setIsConfused] = useState(false);
  const [isSquinting, setIsSquinting] = useState(false);
  const [isLookingAtSubmit, setIsLookingAtSubmit] = useState(false);
  const [isLookingAtShowPassword, setIsLookingAtShowPassword] = useState(false);
  const [isLoadingAnimation, setIsLoadingAnimation] = useState(false);
  const [isErrorReaction, setIsErrorReaction] = useState(false);
  const [isPasswordShown, setIsPasswordShown] = useState(false);
  const [showMagnifyingGlass, setShowMagnifyingGlass] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const peekIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const peekCountRef = useRef(0);
  const isPasswordFocusedRef = useRef(isPasswordFocused);
  const peekAnimationRef = useRef(peekAnimation);
  const usernameValueRef = useRef(usernameValue);
  const lastUsernameLengthRef = useRef(0);
  const usernameChangeTimeRef = useRef(0);
  const doubleBlinkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingAnimationIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Detect quick username input for surprised reaction
  useEffect(() => {
    const currentLength = usernameValue.length;
    const previousLength = lastUsernameLengthRef.current;
    
    if (currentLength > previousLength) {
      const now = Date.now();
      const timeSinceLastChange = now - usernameChangeTimeRef.current;
      
      // If user typed multiple characters quickly (within 200ms), show surprised
      if (timeSinceLastChange < 200 && currentLength - previousLength > 1) {
        setIsSurprised(true);
        setTimeout(() => setIsSurprised(false), 800);
      }
      
      usernameChangeTimeRef.current = now;
    }
    
    lastUsernameLengthRef.current = currentLength;
    usernameValueRef.current = usernameValue;
  }, [usernameValue]);

  // Track text cursor position in username field
  useEffect(() => {
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
      document.body.removeChild(measureSpan);
      return;
    }

    const updateEyePosition = () => {
      if (!usernameInput) return;
      
      // Check if username input is actually focused (more reliable than state)
      if (document.activeElement !== usernameInput) return;
      
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (!usernameInput) return;
        
        // Double-check focus state
        if (document.activeElement !== usernameInput) return;
        
        // Get cursor position in input
        const textLength = usernameInput.value.length;
        let cursorPosition = usernameInput.selectionEnd ?? usernameInput.selectionStart ?? textLength;
        
        if ((cursorPosition === 0 || cursorPosition === null) && textLength > 0) {
          cursorPosition = textLength;
        }
        
        cursorPosition = Math.max(0, Math.min(cursorPosition, textLength));
        
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
        const scrollLeft = usernameInput.scrollLeft || 0;
        
        // Calculate relative position (0 to 1) based on actual cursor pixel position
        let relativePosition = 0;
        if (inputWidth > 0 && textLength > 0) {
          const visibleStart = scrollLeft;
          const visibleEnd = scrollLeft + inputWidth;
          const cursorPixelPos = textWidth;
          
          if (cursorPixelPos < visibleStart) {
            relativePosition = 0;
          } else if (cursorPixelPos > visibleEnd) {
            relativePosition = 1;
          } else {
            relativePosition = (cursorPixelPos - visibleStart) / inputWidth;
            relativePosition = Math.max(0, Math.min(1, relativePosition));
          }
        } else if (textLength === 0) {
          relativePosition = 0;
        }
        
        // Map to eye position (-0.4 to 0.4) for horizontal movement
        const eyeX = (relativePosition - 0.5) * 0.8;
        const eyeY = 0.3; // Look down
        
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
        // Only update eye position when eye is fully open (50% open)
        // This keeps the pupil and eye position in sync - both appear after eye is fully open
        const minEyeOpenForTracking = 0.5;
        if (eyeOpenAmount < minEyeOpenForTracking) {
          return; // Don't update position until eye is fully open
        }
        
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

  // Blink animation (only when not typing password) - random intervals for natural look with double-blink
  useEffect(() => {
    if (isPasswordFocused) return;
    
    let timeoutId: NodeJS.Timeout | null = null;
    let isActive = true;
    
    const scheduleNextBlink = () => {
      if (!isActive) return;
      
      // Random interval between 2 to 8 seconds for natural blinking
      const minInterval = 2000;
      const maxInterval = 8000;
      const randomValue = Math.random();
      const weightedRandom = randomValue < 0.7 
        ? Math.random() * (maxInterval - minInterval) * 0.6 + minInterval
        : Math.random() * (maxInterval - minInterval) * 0.4 + minInterval + (maxInterval - minInterval) * 0.6;
      const randomInterval = weightedRandom;
      
      timeoutId = setTimeout(() => {
        if (!isActive) return;
        
        // 15% chance of double-blink
        const isDoubleBlink = Math.random() < 0.15;
        
        const performBlink = () => {
          setIsBlinking(true);
          setTimeout(() => {
            setIsBlinking(false);
            if (isDoubleBlink) {
              // Second blink after short pause
              setTimeout(() => {
                if (!isActive) return;
                setIsBlinking(true);
                setTimeout(() => {
                  setIsBlinking(false);
                  scheduleNextBlink();
                }, 100);
              }, 150);
            } else {
              scheduleNextBlink();
            }
          }, 100);
        };
        
        performBlink();
      }, randomInterval);
    };
    
    // Start the first blink after a random initial delay (1-3 seconds)
    const initialDelay = Math.random() * 2000 + 1000;
    timeoutId = setTimeout(() => {
      scheduleNextBlink();
    }, initialDelay);

    return () => {
      isActive = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (doubleBlinkTimeoutRef.current) {
        clearTimeout(doubleBlinkTimeoutRef.current);
      }
    };
  }, [isPasswordFocused]);

  // Update refs when state changes
  useEffect(() => {
    isPasswordFocusedRef.current = isPasswordFocused;
  }, [isPasswordFocused]);
  
  useEffect(() => {
    peekAnimationRef.current = peekAnimation;
  }, [peekAnimation]);

  // Password validation - squint when password is too short/weak
  useEffect(() => {
    if (!isPasswordFocused || passwordValue.length === 0) {
      setIsSquinting(false);
      return;
    }
    
    // Squint if password is less than 6 characters
    setIsSquinting(passwordValue.length < 6);
  }, [passwordValue, isPasswordFocused]);

  // Error reaction - confused look when error occurs
  useEffect(() => {
    if (hasError) {
      setIsConfused(true);
      setIsErrorReaction(true);
      // Look away awkwardly
      setEyePosition({ x: 0.5, y: 0.2 });
      setTimeout(() => {
        setIsConfused(false);
        setIsErrorReaction(false);
        setEyePosition({ x: 0, y: 0.3 });
      }, 2000);
    }
  }, [hasError]);

  // Loading animation - eyes look up and down
  useEffect(() => {
    if (isLoading) {
      setIsLoadingAnimation(true);
      let direction = 1; // 1 for down, -1 for up
      let currentY = 0.3;
      
      loadingAnimationIntervalRef.current = setInterval(() => {
        currentY += direction * 0.2;
        if (currentY > 0.5) {
          direction = -1;
          currentY = 0.5;
        } else if (currentY < -0.2) {
          direction = 1;
          currentY = -0.2;
        }
        setEyePosition(prev => ({ ...prev, y: currentY }));
      }, 300);
    } else {
      setIsLoadingAnimation(false);
      if (loadingAnimationIntervalRef.current) {
        clearInterval(loadingAnimationIntervalRef.current);
        loadingAnimationIntervalRef.current = null;
      }
    }
    
    return () => {
      if (loadingAnimationIntervalRef.current) {
        clearInterval(loadingAnimationIntervalRef.current);
      }
    };
  }, [isLoading]);

  // Look at submit button when hovering
  useEffect(() => {
    const submitButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    if (!submitButton) return;

    const handleMouseEnter = () => {
      setIsLookingAtSubmit(true);
      if (containerRef.current && submitButton) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const buttonRect = submitButton.getBoundingClientRect();
        const centerX = containerRect.left + containerRect.width / 2;
        const centerY = containerRect.top + containerRect.height / 2;
        const buttonCenterX = buttonRect.left + buttonRect.width / 2;
        const buttonCenterY = buttonRect.top + buttonRect.height / 2;
        
        const relativeX = (buttonCenterX - centerX) / (containerRect.width / 2);
        const relativeY = (buttonCenterY - centerY) / (containerRect.height / 2);
        
        const maxMovement = 0.4;
        const clampedX = Math.max(-maxMovement, Math.min(maxMovement, relativeX));
        const clampedY = Math.max(-maxMovement, Math.min(maxMovement, relativeY));
        
        setEyePosition({ x: clampedX, y: clampedY });
      }
    };

    const handleMouseLeave = () => {
      setIsLookingAtSubmit(false);
      if (!isUsernameFocused && !isPasswordFocused) {
        setEyePosition({ x: 0, y: 0.3 });
      }
    };

    submitButton.addEventListener('mouseenter', handleMouseEnter);
    submitButton.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      submitButton.removeEventListener('mouseenter', handleMouseEnter);
      submitButton.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isUsernameFocused, isPasswordFocused]);

  // Detect when password is shown/hidden
  useEffect(() => {
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    if (!passwordInput) return;

    const checkPasswordVisibility = () => {
      const isShown = passwordInput.type === 'text';
      if (isShown !== isPasswordShown) {
        setIsPasswordShown(isShown);
        if (isShown) {
          // Password just became visible - show magnifying glass after eyes widen
          setIsSurprised(true); // Keep eyes wide
          setTimeout(() => {
            setShowMagnifyingGlass(true);
            // Close right eye, magnify left eye
            setIsWinking(true);
            setWinkingEye('right');
          }, 300); // Wait for eyes to widen first
        } else {
          // Password hidden - hide magnifying glass
          setShowMagnifyingGlass(false);
          setIsWinking(false);
          setWinkingEye(null);
          setIsSurprised(false);
        }
      }
    };

    // Check initially
    checkPasswordVisibility();

    // Watch for changes
    const observer = new MutationObserver(checkPasswordVisibility);
    observer.observe(passwordInput, { attributes: true, attributeFilter: ['type'] });

    // Also check on input events (in case type changes)
    passwordInput.addEventListener('input', checkPasswordVisibility);

    return () => {
      observer.disconnect();
      passwordInput.removeEventListener('input', checkPasswordVisibility);
    };
  }, [isPasswordShown]);

  // Look at show password toggle when hovering
  useEffect(() => {
    // Find password input and check for show/hide password button
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    if (!passwordInput) return;

    const findShowPasswordButton = () => {
      // Look for button near password input
      const parent = passwordInput.parentElement;
      if (!parent) return null;
      
      // Check for button with type="button" near password field
      // Look for button with aria-label containing "password" or "Show"/"Hide"
      const buttons = Array.from(parent.querySelectorAll('button[type="button"]'));
      for (const btn of buttons) {
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        const textContent = btn.textContent?.toLowerCase() || '';
        // Check if it's a show/hide password button
        if (ariaLabel.includes('password') || ariaLabel.includes('show') || ariaLabel.includes('hide') ||
            textContent.includes('show') || textContent.includes('hide')) {
          return btn;
        }
      }
      return null;
    };

    const showPasswordButton = findShowPasswordButton();
    if (!showPasswordButton) return;

    const handleMouseEnter = () => {
      setIsLookingAtShowPassword(true);
      // Eyes widen (surprised look)
      setIsSurprised(true);
      if (containerRef.current && showPasswordButton) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const buttonRect = showPasswordButton.getBoundingClientRect();
        const centerX = containerRect.left + containerRect.width / 2;
        const centerY = containerRect.top + containerRect.height / 2;
        const buttonCenterX = buttonRect.left + buttonRect.width / 2;
        const buttonCenterY = buttonRect.top + buttonRect.height / 2;
        
        const relativeX = (buttonCenterX - centerX) / (containerRect.width / 2);
        const relativeY = (buttonCenterY - centerY) / (containerRect.height / 2);
        
        const maxMovement = 0.4;
        const clampedX = Math.max(-maxMovement, Math.min(maxMovement, relativeX));
        const clampedY = Math.max(-maxMovement, Math.min(maxMovement, relativeY));
        
        setEyePosition({ x: clampedX, y: clampedY });
      }
    };

    const handleMouseLeave = () => {
      setIsLookingAtShowPassword(false);
      // Don't remove surprised look if password is shown (magnifying glass effect)
      if (!isPasswordShown) {
        setIsSurprised(false);
      }
      if (!isUsernameFocused && !isPasswordFocused && !isPasswordShown) {
        setEyePosition({ x: 0, y: 0.3 });
      }
    };

    showPasswordButton.addEventListener('mouseenter', handleMouseEnter);
    showPasswordButton.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      showPasswordButton.removeEventListener('mouseenter', handleMouseEnter);
      showPasswordButton.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isUsernameFocused, isPasswordFocused, isPasswordShown]);

  // Click handler for winking
  const handleEyeClick = (eye: 'left' | 'right') => {
    // Don't allow manual winking when magnifying glass is active
    if (showMagnifyingGlass) return;
    if (isWinking) return; // Prevent multiple winks
    
    setIsWinking(true);
    setWinkingEye(eye);
    
    setTimeout(() => {
      setIsWinking(false);
      setWinkingEye(null);
    }, 200);
  };

  // Password peek animation - one eye opens halfway (no magnifying glass)
  useEffect(() => {
    if (!isPasswordFocused) {
      // Reset peek animation when password field loses focus
      setPeekAnimation({ isPeeking: false, eye: 'left', progress: 0 });
      peekCountRef.current = 0;
      if (peekIntervalRef.current) {
        clearTimeout(peekIntervalRef.current);
        peekIntervalRef.current = null;
      }
      return;
    }
    
    // Start peek animation loop (3 times)
    peekCountRef.current = 0;
    let animationFrameId: number | null = null;
    let isActive = true;
    
    const startPeek = () => {
      // Check if still focused and haven't exceeded peek count
      if (!isPasswordFocusedRef.current || peekCountRef.current >= 3 || !isActive) {
        setPeekAnimation({ isPeeking: false, eye: 'left', progress: 0 });
        return;
      }
      
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
          progress: easedProgress,
        });

        if (progress < 1 && isActive && isPasswordFocusedRef.current) {
          animationFrameId = requestAnimationFrame(animate);
        } else {
          // Close eye after peek
          if (isActive && isPasswordFocusedRef.current) {
            setTimeout(() => {
              if (!isActive || !isPasswordFocusedRef.current) return;
              
              setPeekAnimation({ isPeeking: false, eye, progress: 0 });
              peekCountRef.current++;
              
              // Wait 1 second before next peek
              if (peekCountRef.current < 3 && isPasswordFocusedRef.current && isActive) {
                peekIntervalRef.current = setTimeout(startPeek, 1000);
              }
            }, 300); // Show peek for 300ms
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

  // Eye close animation - smooth transition
  // Handles: blink, wink, peek, squint, surprised, confused, magnifying glass
  const getEyeHeight = (isLeft: boolean) => {
    // Magnifying glass effect - left eye appears magnified, right eye closes
    if (showMagnifyingGlass) {
      if (isLeft) {
        // Left eye magnified through glass (appears 1.5x larger - more subtle)
        return eyeRadius * 2 * 1.5;
      } else {
        // Right eye closed
        return eyeRadius * 2 * 0.02;
      }
    }
    
    // Winking - one eye closes
    if (isWinking && winkingEye === (isLeft ? 'left' : 'right')) {
      return eyeRadius * 2 * 0.02; // Almost fully closed
    }
    
    // If blinking, close the eye completely (both eyes blink together)
    if (isBlinking && !isPasswordFocused && !showMagnifyingGlass) {
      return eyeRadius * 2 * 0.02; // Almost fully closed for natural blink (2%)
    }
    
    // Surprised - eyes widen (or keep wide if magnifying glass is active)
    if (isSurprised && !isPasswordFocused) {
      return eyeRadius * 2 * 1.2; // 20% wider
    }
    
    // Squinting - eyes narrow
    if (isSquinting && isPasswordFocused && !showMagnifyingGlass) {
      return eyeRadius * 2 * 0.3; // Narrower
    }
    
    // Confused - eyes cross (left looks right, right looks left)
    // Height stays normal but position changes
    
    if (isPasswordFocused && !showMagnifyingGlass) {
      if (peekAnimation.isPeeking && peekAnimation.eye === (isLeft ? 'left' : 'right')) {
        // Peeking eye opens halfway
        const eyeOpenAmount = 0.05 + (0.5 - 0.05) * peekAnimation.progress;
        const height = eyeRadius * 2 * eyeOpenAmount;
        return height;
      }
      // Both eyes closed
      return eyeRadius * 2 * 0.05; // Almost closed
    }
    // Normal open
    return eyeRadius * 2;
  };
  
  // Calculate pupil position with confused state (crossed eyes)
  const getPupilPosition = (isLeft: boolean) => {
    let x = eyePosition.x;
    let y = eyePosition.y;
    
    // Confused - eyes cross (left looks right, right looks left)
    if (isConfused) {
      x = isLeft ? 0.4 : -0.4; // Left eye looks right, right eye looks left
      y = 0.1;
    }
    
    return {
      x: x * (eyeRadius - pupilRadius - 2),
      y: y * (eyeRadius - pupilRadius - 2)
    };
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
        {/* Left Eye - only show when magnifying glass is NOT active */}
        {!showMagnifyingGlass && (
          <g 
            transform="translate(30, 40)"
            onClick={() => handleEyeClick('left')}
            style={{ cursor: 'pointer' }}
          >
            {/* When winking or blinking, show upward C shape (closed eye) */}
            {(isWinking && winkingEye === 'left') || (isBlinking && !isPasswordFocused) ? (
              <path
                d={`M ${-eyeRadius} 0 Q 0 ${-eyeRadius * 0.4} ${eyeRadius} 0`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="text-gray-800 dark:text-gray-200 transition-all ease-in-out"
                style={{ 
                  transitionDuration: '300ms',
                  transitionTimingFunction: 'ease-in-out'
                }}
              />
            ) : (
              <>
                <ellipse
                  cx="0"
                  cy="0"
                  rx={eyeRadius}
                  ry={leftEyeHeight / 2}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-gray-800 dark:text-gray-200 transition-all ease-in-out"
                  style={{ 
                    transitionDuration: isBlinking ? '100ms' : '300ms',
                    transitionTimingFunction: 'ease-in-out'
                  }}
                />
                 {/* Show pupil - for password peek, wait until eye is fully open */}
                 {(() => {
                   const eyeOpenAmount = isPasswordFocused && peekAnimation.isPeeking && peekAnimation.eye === 'left'
                     ? 0.05 + (0.5 - 0.05) * peekAnimation.progress
                     : 1;
                   
                   const minEyeOpenForPupil = 0.5;
                   const shouldShow = (!isPasswordFocused && !isBlinking && !isWinking) || (peekAnimation.isPeeking && peekAnimation.eye === 'left' && eyeOpenAmount >= minEyeOpenForPupil);
                   
                   const opacity = isBlinking 
                     ? 0
                     : (isPasswordFocused && peekAnimation.isPeeking && peekAnimation.eye === 'left' 
                       ? eyeOpenAmount >= minEyeOpenForPupil ? 1 : 0
                       : 1);
                   
                   if (!shouldShow || opacity <= 0) {
                     return null;
                   }
                   
                   const pupilPos = getPupilPosition(true);
                   
                   return (
                     <circle
                       cx={pupilPos.x}
                       cy={pupilPos.y}
                       r={pupilRadius}
                       fill="currentColor"
                       className="text-gray-800 dark:text-gray-200 transition-all ease-out"
                       style={{ 
                         opacity,
                         transitionDuration: isBlinking ? '50ms' : '300ms'
                       }}
                     />
                   );
                 })()}
              </>
            )}
          </g>
        )}
        
        {/* Magnifying Glass - pupil only */}
        {showMagnifyingGlass && (() => {
          const pupilPos = getPupilPosition(true);
          return (
            <g transform="translate(30, 40)">
              {/* Magnified pupil inside glass - only one pupil visible */}
              <circle
                cx={pupilPos.x}
                cy={pupilPos.y}
                r={pupilRadius * 1.3}
                fill="currentColor"
                className="text-gray-800 dark:text-gray-200"
              />
            </g>
          );
        })()}
        
        {/* Glass frame and handle - rendered separately so it's not clipped */}
        {showMagnifyingGlass && (
          <g transform="translate(30, 40)">
            {/* Glass circle - smaller to fit fully in view (1.1x to ensure no clipping) */}
            <circle
              cx="0"
              cy="0"
              r={eyeRadius * 1.1}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-gray-800 dark:text-gray-200"
              opacity="0.8"
            />
            {/* Glass handle - shorter to fit in view */}
            <line
              x1={eyeRadius * 0.9}
              y1={eyeRadius * 0.9}
              x2={eyeRadius * 1.4}
              y2={eyeRadius * 1.4}
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="text-gray-800 dark:text-gray-200"
            />
          </g>
        )}

        {/* Right Eye */}
        <g 
          transform="translate(110, 40)"
          onClick={() => handleEyeClick('right')}
          style={{ cursor: 'pointer' }}
        >
          {/* When closed (magnifying glass, winking, or blinking), show upward C shape (closed eye) */}
          {(showMagnifyingGlass || (isWinking && winkingEye === 'right') || (isBlinking && !isPasswordFocused)) ? (
            <path
              d={`M ${-eyeRadius} 0 Q 0 ${-eyeRadius * 0.4} ${eyeRadius} 0`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-gray-800 dark:text-gray-200 transition-all ease-in-out"
              style={{ 
                transitionDuration: '300ms',
                transitionTimingFunction: 'ease-in-out'
              }}
            />
          ) : (
            <>
              <ellipse
                cx="0"
                cy="0"
                rx={eyeRadius}
                ry={rightEyeHeight / 2}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-gray-800 dark:text-gray-200 transition-all ease-in-out"
                style={{ 
                  transitionDuration: (isBlinking || isWinking) ? '100ms' : '300ms',
                  transitionTimingFunction: 'ease-in-out'
                }}
              />
              {!isPasswordFocused && !isBlinking && !isWinking && (() => {
                const pupilPos = getPupilPosition(false);
                return (
                  <circle
                    cx={pupilPos.x}
                    cy={pupilPos.y}
                    r={pupilRadius}
                    fill="currentColor"
                    className="text-gray-800 dark:text-gray-200 transition-all ease-out"
                    style={{ 
                      transitionDuration: (isBlinking || isWinking) ? '50ms' : '300ms'
                    }}
                  />
                );
              })()}
            </>
          )}
        </g>
      </svg>
    </div>
  );
};

