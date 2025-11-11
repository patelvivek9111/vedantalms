import React, { useEffect, useRef, useState } from 'react';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';

interface LottieLoginAnimationProps {
  animationState: 'idle' | 'typing' | 'success' | 'error' | 'loading';
  className?: string;
}

// Simple Lottie animations - using minimal working structures
// You can replace these with actual Lottie JSON files from LottieFiles
const createIdleAnimation = () => ({
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 120,
  w: 400,
  h: 400,
  nm: 'Idle Book',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Book',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 1, k: [
          { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [0] },
          { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 60, s: [5] },
          { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 120, s: [0] }
        ]},
        p: { a: 0, k: [200, 200, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] }
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              ty: 'rc',
              d: 1,
              s: { a: 0, k: [120, 80] },
              p: { a: 0, k: [0, 0] },
              r: { a: 0, k: 8 },
              nm: 'Book Cover'
            },
            {
              ty: 'fl',
              c: { a: 0, k: [0.2, 0.4, 0.8, 1] },
              o: { a: 0, k: 100 },
              r: 1,
              bm: 0,
              nm: 'Fill'
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              sk: { a: 0, k: 0 },
              sa: { a: 0, k: 0 },
              nm: 'Transform'
            }
          ],
          nm: 'Book',
          bm: 0
        }
      ],
      ip: 0,
      op: 120,
      st: 0,
      bm: 0
    }
  ]
});

const createTypingAnimation = () => ({
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 60,
  w: 400,
  h: 400,
  nm: 'Typing',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Cursor',
      sr: 1,
      ks: {
        o: { a: 1, k: [
          { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [100] },
          { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 15, s: [0] },
          { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 30, s: [100] },
          { t: 60, s: [0] }
        ]},
        r: { a: 0, k: 0 },
        p: { a: 0, k: [200, 200, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] }
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              ty: 'rc',
              d: 1,
              s: { a: 0, k: [4, 20] },
              p: { a: 0, k: [0, 0] },
              r: { a: 0, k: 2 },
              nm: 'Cursor'
            },
            {
              ty: 'fl',
              c: { a: 0, k: [0.4, 0.6, 1, 1] },
              o: { a: 0, k: 100 },
              r: 1,
              bm: 0,
              nm: 'Fill'
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              sk: { a: 0, k: 0 },
              sa: { a: 0, k: 0 },
              nm: 'Transform'
            }
          ],
          nm: 'Cursor Shape',
          bm: 0
        }
      ],
      ip: 0,
      op: 60,
      st: 0,
      bm: 0
    }
  ]
});

const createSuccessAnimation = () => ({
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 60,
  w: 400,
  h: 400,
  nm: 'Success',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Checkmark',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [200, 200, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [
          { i: { x: [0.833, 0.833, 0.833], y: [0.833, 0.833, 0.833] }, o: { x: [0.167, 0.167, 0.167], y: [0.167, 0.167, 0.167] }, t: 0, s: [0, 0, 100] },
          { i: { x: [0.833, 0.833, 0.833], y: [0.833, 0.833, 0.833] }, o: { x: [0.167, 0.167, 0.167], y: [0.167, 0.167, 0.167] }, t: 30, s: [110, 110, 100] },
          { t: 60, s: [100, 100, 100] }
        ]}
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              ind: 0,
              ty: 'sh',
              ix: 1,
              ks: {
                a: 0,
                k: {
                  i: [[0, 0], [0, 0], [0, 0]],
                  o: [[0, 0], [0, 0], [0, 0]],
                  v: [[-25, 0], [0, 20], [25, -20]],
                  c: false
                }
              },
              nm: 'Check Path'
            },
            {
              ty: 'st',
              c: { a: 0, k: [0.2, 0.8, 0.4, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 10 },
              lc: 2,
              lj: 2,
              ml: 4,
              bm: 0,
              nm: 'Stroke'
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              sk: { a: 0, k: 0 },
              sa: { a: 0, k: 0 },
              nm: 'Transform'
            }
          ],
          nm: 'Checkmark',
          bm: 0
        }
      ],
      ip: 0,
      op: 60,
      st: 0,
      bm: 0
    }
  ]
});

const createErrorAnimation = () => ({
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 60,
  w: 400,
  h: 400,
  nm: 'Error',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'X',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 1, k: [
          { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [0] },
          { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 30, s: [180] },
          { t: 60, s: [360] }
        ]},
        p: { a: 0, k: [200, 200, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [
          { i: { x: [0.833, 0.833, 0.833], y: [0.833, 0.833, 0.833] }, o: { x: [0.167, 0.167, 0.167], y: [0.167, 0.167, 0.167] }, t: 0, s: [0, 0, 100] },
          { i: { x: [0.833, 0.833, 0.833], y: [0.833, 0.833, 0.833] }, o: { x: [0.167, 0.167, 0.167], y: [0.167, 0.167, 0.167] }, t: 30, s: [120, 120, 100] },
          { t: 60, s: [100, 100, 100] }
        ]}
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              ind: 0,
              ty: 'sh',
              ix: 1,
              ks: {
                a: 0,
                k: {
                  i: [[0, 0], [0, 0], [0, 0], [0, 0]],
                  o: [[0, 0], [0, 0], [0, 0], [0, 0]],
                  v: [[-20, -20], [20, -20], [20, 20], [-20, 20]],
                  c: true
                }
              },
              nm: 'X Shape'
            },
            {
              ty: 'st',
              c: { a: 0, k: [0.9, 0.2, 0.2, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 8 },
              lc: 2,
              lj: 2,
              ml: 4,
              bm: 0,
              nm: 'Stroke'
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              sk: { a: 0, k: 0 },
              sa: { a: 0, k: 0 },
              nm: 'Transform'
            }
          ],
          nm: 'X',
          bm: 0
        }
      ],
      ip: 0,
      op: 60,
      st: 0,
      bm: 0
    }
  ]
});

const createLoadingAnimation = () => ({
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 90,
  w: 400,
  h: 400,
  nm: 'Loading',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Spinner',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 1, k: [
          { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [0] },
          { t: 90, s: [720] }
        ]},
        p: { a: 0, k: [200, 200, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] }
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              d: 1,
              ty: 'el',
              s: { a: 0, k: [60, 60] },
              p: { a: 0, k: [0, 0] },
              nm: 'Circle'
            },
            {
              ty: 'st',
              c: { a: 0, k: [0.4, 0.6, 1, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 6 },
              lc: 2,
              lj: 2,
              ml: 4,
              bm: 0,
              nm: 'Stroke'
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              sk: { a: 0, k: 0 },
              sa: { a: 0, k: 0 },
              nm: 'Transform'
            }
          ],
          nm: 'Spinner',
          bm: 0
        }
      ],
      ip: 0,
      op: 90,
      st: 0,
      bm: 0
    }
  ]
});

export const LottieLoginAnimation: React.FC<LottieLoginAnimationProps> = ({ 
  animationState, 
  className = '' 
}) => {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const [currentAnimation, setCurrentAnimation] = useState<any>(createIdleAnimation());
  const shouldLoop = animationState === 'idle' || animationState === 'loading' || animationState === 'typing';

  useEffect(() => {
    // Update animation based on state
    switch (animationState) {
      case 'typing':
        setCurrentAnimation(createTypingAnimation());
        break;
      case 'success':
        setCurrentAnimation(createSuccessAnimation());
        break;
      case 'error':
        setCurrentAnimation(createErrorAnimation());
        break;
      case 'loading':
        setCurrentAnimation(createLoadingAnimation());
        break;
      default:
        setCurrentAnimation(createIdleAnimation());
    }
    
    // Play animation when state changes
    if (lottieRef.current) {
      lottieRef.current.play();
    }
  }, [animationState]);

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Lottie
        lottieRef={lottieRef}
        animationData={currentAnimation}
        loop={shouldLoop}
        autoplay={true}
        style={{ width: '100%', height: '100%', maxWidth: '300px', maxHeight: '300px' }}
      />
    </div>
  );
};
