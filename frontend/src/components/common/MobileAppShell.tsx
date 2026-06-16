import React, { useState } from 'react';
import MobileTopNav from './MobileTopNav';
import { BurgerMenu } from '../layout/BurgerMenu';

type MobileAppShellProps = {
  title: string;
  backButtonPath?: string;
  backButtonLabel?: string;
  children: React.ReactNode;
  contentClassName?: string;
  customRightAction?: React.ReactNode;
};

/** Mobile top bar + account menu + safe padding for bottom nav. Desktop layout unchanged. */
export function MobileAppShell({
  title,
  backButtonPath,
  backButtonLabel,
  children,
  contentClassName = '',
  customRightAction,
}: MobileAppShellProps) {
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const hasBack = Boolean(backButtonPath);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <MobileTopNav
        title={title}
        backButtonPath={backButtonPath}
        backButtonLabel={backButtonLabel}
        leftAction={hasBack ? 'back' : 'user'}
        onLeftActionClick={hasBack ? undefined : () => setShowBurgerMenu(true)}
        rightAction={customRightAction ? 'custom' : 'none'}
        customRightAction={customRightAction}
      />
      <BurgerMenu
        showBurgerMenu={showBurgerMenu}
        setShowBurgerMenu={setShowBurgerMenu}
      />
      <div className={`pt-20 lg:pt-0 mobile-bottom-nav-clearance lg:!pb-0 ${contentClassName}`}>{children}</div>
    </div>
  );
}
