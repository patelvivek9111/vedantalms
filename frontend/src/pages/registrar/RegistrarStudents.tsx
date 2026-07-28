import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { registrarGet } from './registrarApi';
import { ru } from './registrarUi';

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
    <div className={ru.page}>
      <form onSubmit={search} className={`${ru.card} flex flex-wrap gap-2 items-end`}>
        <label className={`${ru.label} flex-1 min-w-[200px]`}>
          Search students
          <input
            className={ru.input}
            placeholder="Name, email, admission #, or student id"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            minLength={2}
            required
          />
        </label>
        <button type="submit" className={ru.btnPrimary}>
          Search
        </button>
      </form>

      {error && <div className={ru.alertError}>{error}</div>}
      {loading && <p className={ru.muted}>Searching…</p>}

      <ul className={ru.list}>
        {rows.map((s) => (
          <li key={s._id} className={`${ru.listItem} flex justify-between gap-2`}>
            <div>
              <div className="font-medium">
                {s.firstName} {s.lastName}
              </div>
              <div className={ru.muted}>
                {s.email}
                {s.studentProfile?.admissionNumber ? ` · Adm ${s.studentProfile.admissionNumber}` : ''}
                {typeof s.studentProfile?.programId === 'object' && s.studentProfile.programId?.code
                  ? ` · ${s.studentProfile.programId.code}`
                  : ''}
              </div>
            </div>
            <Link className={ru.link} to={`/registrar/students/${s._id}`}>
              Open
            </Link>
          </li>
        ))}
        {!loading && !rows.length && (
          <li className={ru.empty}>No results. Search by name or email.</li>
        )}
      </ul>
    </div>
  );
}

export default RegistrarStudents;
