import React from 'react';
import { Laptop, LogOut, Smartphone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function AdminPhoneBlocked() {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:p-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
          <div className="relative">
            <Smartphone className="h-7 w-7 text-amber-700 dark:text-amber-400" aria-hidden />
            <Laptop
              className="absolute -bottom-1 -right-2 h-4 w-4 text-gray-500 dark:text-gray-400"
              aria-hidden
            />
          </div>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 sm:text-2xl">
          Admin access is not available on phones
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          For security and usability, administrator accounts must be used on a laptop or desktop
          computer with a larger screen. Please sign in again from a computer to manage the
          system.
        </p>

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  );
}
