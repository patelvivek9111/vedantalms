import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { registrarGet, registrarPatch, registrarPost } from './registrarApi';

type Program = {
  _id: string;
  code: string;
  name: string;
  level?: string;
  durationTerms?: number;
  requiredCredits?: number;
  isActive?: boolean;
  description?: string;
};

const empty = {
  code: '',
  name: '',
  level: 'ug',
  durationTerms: '8',
  requiredCredits: '120',
  description: '',
};

export function RegistrarPrograms() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all = await registrarGet<{ data: Program[] }>('/api/registrar/programs', {
        active: 'all',
      });
      setPrograms(all.data || []);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Failed to load programs'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      level: form.level,
      durationTerms: Number(form.durationTerms) || 0,
      requiredCredits: Number(form.requiredCredits) || 0,
      description: form.description.trim(),
    };
    try {
      if (editingId) {
        const { code: _c, ...patch } = payload;
        void _c;
        await registrarPatch(`/api/registrar/programs/${editingId}`, patch);
        setMessage('Program updated');
      } else {
        await registrarPost('/api/registrar/programs', payload);
        setMessage('Program created');
      }
      setEditingId(null);
      setForm(empty);
      await load();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Save failed'
      );
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <form
        onSubmit={submit}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 border rounded-md p-4 border-gray-200 dark:border-gray-700 text-sm"
      >
        <h2 className="sm:col-span-2 lg:col-span-3 text-lg font-medium">
          {editingId ? 'Edit program' : 'Create program'}
        </h2>
        <label>
          Code
          <input
            className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            required
            disabled={Boolean(editingId)}
          />
        </label>
        <label className="sm:col-span-2">
          Name
          <input
            className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </label>
        <label>
          Level
          <select
            className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
            value={form.level}
            onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
          >
            {['ug', 'pg', 'diploma', 'school', 'certificate', 'other'].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Duration (terms)
          <input
            type="number"
            className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
            value={form.durationTerms}
            onChange={(e) => setForm((f) => ({ ...f, durationTerms: e.target.value }))}
          />
        </label>
        <label>
          Required credits
          <input
            type="number"
            className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
            value={form.requiredCredits}
            onChange={(e) => setForm((f) => ({ ...f, requiredCredits: e.target.value }))}
          />
        </label>
        <label className="sm:col-span-2 lg:col-span-3">
          Description
          <input
            className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>
        <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
          <button type="submit" className="rounded bg-indigo-600 text-white px-3 py-1.5">
            {editingId ? 'Save' : 'Create'}
          </button>
          {editingId && (
            <button
              type="button"
              className="rounded border px-3 py-1.5"
              onClick={() => {
                setEditingId(null);
                setForm(empty);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <section>
        <h2 className="text-lg font-medium mb-2">Programs</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <ul className="divide-y border rounded-md text-sm border-gray-200 dark:border-gray-700">
            {programs.map((p) => (
              <li key={p._id} className="px-3 py-3 flex justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {p.code} · {p.name}
                  </div>
                  <div className="text-gray-500">
                    {p.level} · {p.durationTerms || 0} terms · {p.requiredCredits || 0} credits
                    {p.isActive === false ? ' · inactive' : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-blue-600"
                  onClick={() => {
                    setEditingId(p._id);
                    setForm({
                      code: p.code,
                      name: p.name,
                      level: p.level || 'ug',
                      durationTerms: String(p.durationTerms ?? 0),
                      requiredCredits: String(p.requiredCredits ?? 0),
                      description: p.description || '',
                    });
                  }}
                >
                  Edit
                </button>
              </li>
            ))}
            {!programs.length && <li className="px-3 py-4 text-gray-500">No programs yet.</li>}
          </ul>
        )}
      </section>
    </div>
  );
}

export default RegistrarPrograms;
