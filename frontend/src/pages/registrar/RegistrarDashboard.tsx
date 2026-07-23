import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { registrarGet } from './registrarApi';

type DashboardData = {
  enrollments: { total: number; byStatus: { _id: string; count: number }[] };
  activeHolds: number;
  sisErrors: number;
  activeTerms: number;
  gradeStatus: { coursesLinked: number; finalized: number; unfinalized: number };
};

export function RegistrarDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await registrarGet<{ data: DashboardData }>('/api/registrar/dashboard');
        if (!cancelled) setData(res.data);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            axios.isAxiosError(err) && err.response?.data?.message
              ? String(err.response.data.message)
              : 'Failed to load dashboard'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading dashboard…</p>;
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800">
        {error}
      </div>
    );
  }

  const cards = [
    { label: 'Enrollments', value: data?.enrollments.total ?? 0, to: '/registrar/operations' },
    { label: 'Active holds', value: data?.activeHolds ?? 0, to: '/registrar/operations' },
    { label: 'SIS errors', value: data?.sisErrors ?? 0, to: '/registrar/sis' },
    { label: 'Active / grading terms', value: data?.activeTerms ?? 0, to: '/registrar/terms' },
    { label: 'Unfinalized courses', value: data?.gradeStatus.unfinalized ?? 0, to: '/registrar/grades' },
    { label: 'Finalized courses', value: data?.gradeStatus.finalized ?? 0, to: '/registrar/grades' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 hover:border-indigo-400 transition-colors"
          >
            <div className="text-xs uppercase tracking-wide text-gray-500">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{c.value}</div>
          </Link>
        ))}
      </div>

      {(data?.enrollments.byStatus || []).length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Enrollment by status</h2>
          <div className="flex flex-wrap gap-3 text-sm">
            {data!.enrollments.byStatus.map((row) => (
              <span key={row._id} className="rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-1">
                {row._id}: <strong>{row.count}</strong>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-wrap gap-3 text-sm">
        <Link className="text-blue-600 hover:underline" to="/registrar/terms">
          Manage terms
        </Link>
        <Link className="text-blue-600 hover:underline" to="/registrar/students">
          Search students
        </Link>
        <Link className="text-blue-600 hover:underline" to="/registrar/transcripts">
          Issue transcript
        </Link>
        <Link className="text-blue-600 hover:underline" to="/registrar/reports">
          Reports
        </Link>
      </section>
    </div>
  );
}

export default RegistrarDashboard;
