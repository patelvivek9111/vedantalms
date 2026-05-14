import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';
import { extractJoinTokenFromQrText } from '../../utils/joinCourseToken';

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
    const readerId = 'course-qr-reader';
    const scanner = new Html5QrcodeScanner(
      readerId,
      { fps: 8, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
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

    return () => {
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="relative max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Scan course QR</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Point the camera at your instructor&apos;s course QR, or students can enter the 8-character join code from
          the printed card. If there is room, wait for your instructor to approve your enrollment; if the class is full,
          you&apos;ll join the waitlist (same rules as the catalog).
        </p>
        <div id="course-qr-reader" className="rounded-lg border border-slate-200 dark:border-slate-700" />
      </div>
    </div>
  );
};

export default ScanCourseQrModal;
