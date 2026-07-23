import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { registrarGet } from './registrarApi';

type StudentRow = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  accountStatus?: string;
  studentProfile?: {
    admissionNumber?: string;
    studentId?: string;
    programId?: { code?: string; name?: string } | string;
  };
};

export function RegistrarStudents() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await registrarGet<{ data: StudentRow[] }>('/api/registrar/students/search', { q });
      setRows(res.data || []);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Search failed'
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="flex flex-wrap gap-2 items-end">
        <label className="text-sm flex-1 min-w-[200px]">
            Search students
          <input
            className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1.5"
            placeholder="Name, email, admission #, or student id"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            minLength={2}
            required
          />
        </label>
        <button type="submit" className="rounded bg-indigo-600 text-white px-3 py-1.5 text-sm">
          Search
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
      {loading && <p className="text-sm text-gray-500">Searching…</p>}

      <ul className="divide-y border rounded-md border-gray-200 dark:border-gray-700 text-sm">
        {rows.map((s) => (
          <li key={s._id} className="px-3 py-3 flex justify-between gap-2">
            <div>
              <div className="font-medium">
                {s.firstName} {s.lastName}
              </div>
              <div className="text-gray-500">
                {s.email}
                {s.studentProfile?.admissionNumber ? ` · Adm ${s.studentProfile.admissionNumber}` : ''}
                {typeof s.studentProfile?.programId === 'object' && s.studentProfile.programId?.code
                  ? ` · ${s.studentProfile.programId.code}`
                  : ''}
              </div>
            </div>
            <Link className="text-blue-600 hover:underline" to={`/registrar/students/${s._id}`}>
              Open
            </Link>
          </li>
        ))}
        {!loading && !rows.length && (
          <li className="px-3 py-4 text-gray-500">No results. Search by name or email.</li>
        )}
      </ul>
    </div>
  );
}

export default RegistrarStudents;
