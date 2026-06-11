import React from 'react';
import { ToDoPanel } from '../components/common/ToDoPanel';
import { MobileAppShell } from '../components/common/MobileAppShell';
import SwipeableContainer from '../components/common/SwipeableContainer';
import { useBottomNavSwipe } from '../hooks/useBottomNavSwipe';

const ToDoPage: React.FC = () => {
  const { handleSwipeLeft, handleSwipeRight, enabled: swipeEnabled } = useBottomNavSwipe();

  return (
    <SwipeableContainer
      onSwipeLeft={swipeEnabled ? handleSwipeLeft : undefined}
      onSwipeRight={swipeEnabled ? handleSwipeRight : undefined}
      enabled={swipeEnabled}
      preventScrollInterference={true}
      className="min-h-screen bg-gray-50 dark:bg-gray-900"
    >
      <MobileAppShell title="To Do">
        <div className="mx-auto w-full max-w-4xl px-4 py-3 lg:p-6">
          <ToDoPanel />
        </div>
      </MobileAppShell>
    </SwipeableContainer>
  );
};

export default ToDoPage;
