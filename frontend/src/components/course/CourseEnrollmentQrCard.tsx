import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, QrCode, Loader2, AlertCircle, Copy } from 'lucide-react';
import { toast } from 'react-toastify';
import { API_URL, getAppPublicOrigin } from '../../config';

interface Props {
  courseId: string;
}

const CourseEnrollmentQrCard: React.FC<Props> = ({ courseId }) => {
  const [joinAbsoluteUrl, setJoinAbsoluteUrl] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string>('');
  const [courseTitle, setCourseTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinCodeCopied, setJoinCodeCopied] = useState(false);
  const copyResetTimerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/courses/${courseId}/enrollment-join-info`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.data?.success) {
        setError(res.data?.message || 'Could not load join link');
        return;
      }
      const origin = getAppPublicOrigin();
      const path = res.data.joinPath as string;
      const backendUrl = res.data.joinUrl as string;
      const absolute =
        typeof backendUrl === 'string' && /^https?:\/\//i.test(backendUrl)
          ? backendUrl
          : `${origin}${path.startsWith('/') ? path : `/${path}`}`;
      setJoinAbsoluteUrl(absolute);
      setJoinCode(typeof res.data.joinCode === 'string' ? res.data.joinCode : '');
      setCourseTitle(res.data.courseTitle || '');
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Failed to load QR');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    setJoinCodeCopied(false);
    if (copyResetTimerRef.current != null) {
      window.clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = null;
    }
  }, [joinCode]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current != null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  const copyJoinCode = async () => {
    if (!joinCode) return;
    try {
      await navigator.clipboard.writeText(joinCode);
      setJoinCodeCopied(true);
      if (copyResetTimerRef.current != null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        setJoinCodeCopied(false);
        copyResetTimerRef.current = null;
      }, 1500);
    } catch {
      toast.error('Could not copy. Select the code and copy manually.');
    }
  };

  const handlePrint = () => {
    const prevTitle = document.title;
    document.title = '\u200b';
    let restored = false;
    const restoreTitle = () => {
      if (restored) return;
      restored = true;
      document.title = prevTitle;
    };
    window.addEventListener('afterprint', restoreTitle, { once: true });
    window.setTimeout(restoreTitle, 60_000);
    window.requestAnimationFrame(() => {
      window.print();
    });
  };

  return (
    <>
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          html, body {
            height: 100%;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * { visibility: hidden; }
          #course-enrollment-qr-print,
          #course-enrollment-qr-print * { visibility: visible; }
          #course-enrollment-qr-print {
            position: fixed;
            inset: 0;
            width: 100vw;
            min-height: 100vh;
            box-sizing: border-box;
            margin: 0;
            padding: 12mm 10mm;
            display: flex !important;
            flex-direction: column !important;
            align-items: center;
            justify-content: center;
            background: linear-gradient(160deg, #eef2ff 0%, #f8fafc 38%, #ffffff 72%) !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #course-enrollment-qr-print .qr-print-poster {
            flex: none !important;
            width: 100%;
            max-width: 148mm;
            margin: 0 auto;
            padding: 11mm 12mm 12mm;
            background: #ffffff !important;
            border-radius: 3.5mm;
            border: 0.3mm solid #e2e8f0 !important;
            box-shadow: 0 2mm 6mm rgba(15, 23, 42, 0.07) !important;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #course-enrollment-qr-print .qr-print-body {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          #course-enrollment-qr-print .qr-print-poster-accent {
            position: static !important;
            inset: auto !important;
            display: block !important;
            height: 1.25mm;
            width: 100%;
            max-width: 28mm;
            margin: 0 auto 7mm;
            border-radius: 1mm;
            background: linear-gradient(90deg, #2563eb, #6366f1) !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #course-enrollment-qr-print .qr-print-kicker {
            font-size: 8.5pt !important;
            letter-spacing: 0.24em !important;
            text-transform: uppercase !important;
            font-weight: 600 !important;
            color: #64748b !important;
            margin: 0 0 3.5mm 0 !important;
            text-align: center !important;
          }
          #course-enrollment-qr-print .qr-print-course-title {
            font-size: 17pt !important;
            font-weight: 700 !important;
            letter-spacing: -0.03em !important;
            line-height: 1.28 !important;
            color: #0f172a !important;
            margin: 0 0 4mm 0 !important;
            text-align: center !important;
            max-width: 100%;
          }
          #course-enrollment-qr-print .qr-print-hint {
            font-size: 9.5pt !important;
            line-height: 1.45 !important;
            color: #475569 !important;
            margin: 0 auto 4mm !important;
            text-align: center !important;
            max-width: 118mm;
            font-weight: 400 !important;
          }
          #course-enrollment-qr-print .qr-print-join-code-block {
            margin: 0 auto 5mm !important;
            text-align: center !important;
            max-width: 118mm;
          }
          #course-enrollment-qr-print .qr-print-join-code-label {
            font-size: 8pt !important;
            letter-spacing: 0.2em !important;
            text-transform: uppercase !important;
            font-weight: 600 !important;
            color: #64748b !important;
            margin: 0 0 1.5mm 0 !important;
          }
          #course-enrollment-qr-print .qr-print-join-code-value {
            font-size: 16pt !important;
            font-weight: 700 !important;
            letter-spacing: 0.18em !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
            color: #0f172a !important;
            padding: 2.5mm 4mm !important;
            border: 0.35mm solid #e2e8f0 !important;
            border-radius: 2mm !important;
            background: #f8fafc !important;
            display: inline-block !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #course-enrollment-qr-print .qr-print-qr-wrap {
            display: flex !important;
            justify-content: center !important;
            margin: 0 !important;
            padding: 4.5mm !important;
            background: #fafafa !important;
            border: 0.3mm solid #e2e8f0 !important;
            border-radius: 2.5mm !important;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #course-enrollment-qr-print .qr-print-qr-wrap svg {
            display: block !important;
            width: 46mm !important;
            height: 46mm !important;
          }
          #course-enrollment-qr-print .print-hide-when-printing {
            display: none !important;
          }
        }
      `}</style>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
          <QrCode className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Course join QR
        </div>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Students use <span className="font-medium">Join with QR</span> on their dashboard, scan the QR, or enter the
          8-character join code. When there is space, they wait for the instructor to approve enrollment; if the course
          is full, they join the waitlist the same way as the catalog.
        </p>
        {loading && (
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        )}
        {error && !loading && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <div>{error}</div>
              <button type="button" onClick={load} className="mt-2 font-medium underline">
                Retry
              </button>
            </div>
          </div>
        )}
        {joinAbsoluteUrl && !loading && !error && (
          <div id="course-enrollment-qr-print" className="flex flex-col gap-3">
            <div className="qr-print-poster relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white via-slate-50/40 to-slate-50/80 px-6 py-8 shadow-md shadow-slate-900/5 dark:border-slate-600 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
              <div
                className="qr-print-poster-accent mx-auto h-1 w-20 shrink-0 rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 sm:w-24"
                aria-hidden
              />
              <div className="qr-print-body relative mt-5 sm:mt-6">
                <p className="qr-print-kicker text-center text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  Join this course
                </p>
                <h2 className="qr-print-course-title mt-3 text-balance text-center text-xl font-bold leading-snug tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
                  {courseTitle}
                </h2>
                <p className="qr-print-hint mx-auto mt-4 max-w-sm text-center text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Scan the QR or enter the join code in the app. If there is space, wait for your instructor to approve
                  your enrollment; if the class is full, you&apos;ll be placed on the waitlist.
                </p>
                {joinCode ? (
                  <div className="qr-print-join-code-block mx-auto mt-5 max-w-sm">
                    <p className="qr-print-join-code-label text-center text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                      Join code
                    </p>
                    <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                      <span className="qr-print-join-code-value inline-block rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-xl font-bold tracking-[0.2em] text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                        {joinCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyJoinCode()}
                        className="print-hide-when-printing inline-flex min-w-[5.25rem] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        {joinCodeCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="qr-print-qr-wrap mt-6 flex justify-center rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-950">
                  <QRCodeSVG value={joinAbsoluteUrl} size={216} level="M" includeMargin />
                </div>
              </div>
            </div>

            <div className="print-hide-when-printing mt-4 flex justify-end">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Printer className="h-4 w-4" aria-hidden />
                Print
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CourseEnrollmentQrCard;
