import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { extractJoinTokenFromQrText } from '../../utils/joinCourseToken';

type Html5QrcodeScanner = import('html5-qrcode').Html5QrcodeScanner;

interface ScanCourseQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (tokenOrUrl: string) => void;
}

const ScanCourseQrModal: React.FC<ScanCourseQrModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const settledRef = useRef(false);
  const onScanSuccessRef = useRef(onScanSuccess);
  onScanSuccessRef.current = onScanSuccess;

  useEffect(() => {
    if (!isOpen) return;
    settledRef.current = false;
    let cancelled = false;
    const readerId = 'course-qr-reader';

    void (async () => {
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      if (cancelled) return;

      const scanner = new Html5QrcodeScanner(
        readerId,
        { fps: 8, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
        false
      );
      scannerRef.current = scanner;

      scanner.render(
        (decodedText) => {
          if (settledRef.current) return;
          const token = extractJoinTokenFromQrText(decodedText);
          if (!token) return;
          settledRef.current = true;
          scanner
            .clear()
            .catch(() => {})
            .finally(() => {
              scannerRef.current = null;
              onScanSuccessRef.current(decodedText);
            });
        },
        () => {}
      );
    })();

    return () => {
      cancelled = true;
      settledRef.current = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.clear().catch(() => {});
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-xl border border-gray-200/90 bg-white dark:border-gray-700 dark:bg-gray-800 sm:max-w-md sm:rounded-xl sm:shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700/60">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Scan course QR</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            aria-label="Close scan course QR"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <p className="text-[10px] leading-relaxed text-gray-500 dark:text-gray-400 sm:text-[11px]">
            Point the camera at your instructor&apos;s course QR, or enter the 8-character join code from the printed
            card. If there is room, wait for your instructor to approve your enrollment; if the class is full,
            you&apos;ll join the waitlist (same rules as the catalog).
          </p>
          <div
            id="course-qr-reader"
            className="overflow-hidden rounded-lg border border-gray-200/90 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50 [&_button]:!h-10 [&_button]:!rounded-lg [&_button]:!text-[11px] [&_button]:!font-medium [&_img]:!max-h-28 [&_span]:!text-[10px] [&_span]:!text-gray-500 dark:[&_span]:!text-gray-400"
          />
        </div>
      </div>
    </div>
  );
};

export default ScanCourseQrModal;
