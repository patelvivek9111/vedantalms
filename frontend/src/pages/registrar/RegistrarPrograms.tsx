import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { registrarGet, registrarPatch, registrarPost } from './registrarApi';
import { ru } from './registrarUi';
import { useRegistrarMode } from './useRegistrarMode';

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

const emptySchool = {
  code: '',
  name: '',
  level: 'school',
  durationTerms: '0',
  requiredCredits: '0',
  description: '',
};

const emptyCollege = {
  code: '',
  name: '',
  level: 'ug',
  durationTerms: '8',
  requiredCredits: '120',
  description: '',
};

export function RegistrarPrograms() {
  const { flags, isSchool, loading: modeLoading } = useRegistrarMode();
  const empty = isSchool ? emptySchool : emptyCollege;
  const [programs, setPrograms] = useState<Program[]>([]);
  const [form, setForm] = useState(emptyCollege);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!modeLoading && !editingId) setForm(empty);
  }, [isSchool, modeLoading]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className={ru.page}>
      {error && (
        <div className={ru.alertError}>{error}</div>
      )}
      {message && (
        <div className={ru.alertOk}>
          {message}
        </div>
      )}

      <form
        onSubmit={submit}
        className={`${ru.card} grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm`}
      >
        <h2 className={`${ru.sectionTitle} sm:col-span-2 lg:col-span-3 text-lg`}>
          {editingId ? `Edit ${isSchool ? 'stream' : 'program'}` : `Create ${isSchool ? 'stream' : 'program'}`}
        </h2>
        <p className={`${ru.muted} sm:col-span-2 lg:col-span-3 -mt-1`}>{flags.programsHint}</p>
        <label className={ru.label}>
          Code
          <input
            className={ru.input}
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            required
            disabled={Boolean(editingId)}
          />
        </label>
        <label className={`${ru.label} sm:col-span-2`}>
          Name
          <input
            className={ru.input}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </label>
        <label className={ru.label}>
          Level
          <select
            className={ru.select}
            value={form.level}
            onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
          >
            {(isSchool ? ['school', 'other'] : ['ug', 'pg', 'diploma', 'school', 'certificate', 'other']).map(
              (l) => (
              <option key={l} value={l}>
                {l}
              </option>
            )
            )}
          </select>
        </label>
        <label className={ru.label}>
          Duration (terms)
          <input
            type="number"
            className={ru.input}
            value={form.durationTerms}
            onChange={(e) => setForm((f) => ({ ...f, durationTerms: e.target.value }))}
          />
        </label>
        <label className={ru.label}>
          Required credits
          <input
            type="number"
            className={ru.input}
            value={form.requiredCredits}
            onChange={(e) => setForm((f) => ({ ...f, requiredCredits: e.target.value }))}
          />
        </label>
        <label className={`${ru.label} sm:col-span-2 lg:col-span-3`}>
          Description
          <input
            className={ru.input}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>
        <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
          <button type="submit" className={ru.btnPrimary}>
            {editingId ? 'Save' : 'Create'}
          </button>
          {editingId && (
            <button
              type="button"
              className={ru.btnSecondary}
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
        <h2 className={`${ru.sectionTitle} text-lg mb-2`}>{flags.programsTitle}</h2>
        {loading ? (
          <p className={ru.muted}>Loading…</p>
        ) : (
          <ul className={ru.list}>
            {programs.map((p) => (
              <li key={p._id} className={`${ru.listItem} flex justify-between gap-2`}>
                <div>
                  <div className="font-medium">
                    {p.code} · {p.name}
                  </div>
                  <div className={ru.muted}>
                    {p.level} · {p.durationTerms || 0} terms · {p.requiredCredits || 0} credits
                    {p.isActive === false ? ' · inactive' : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className={ru.link}
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
            {!programs.length && <li className={ru.empty}>No programs yet.</li>}
          </ul>
        )}
      </section>
    </div>
  );
}

export default RegistrarPrograms;
