import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AcademicTerm, registrarGet, registrarPatch, registrarPost } from './registrarApi';
import { ru } from './registrarUi';

const emptyForm = {
  name: '',
  code: '',
  termType: 'semester',
  status: 'upcoming',
  academicYearLabel: '',
  legacyTermLabel: '',
  legacyYear: '',
  startDate: '',
  endDate: '',
  enrollmentOpenDate: '',
  enrollmentCloseDate: '',
  gradingPeriodCloseDate: '',
  finalizeDeadline: '',
};

function toDateInput(value?: string | null) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export function RegistrarTerms() {
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await registrarGet<{ data: AcademicTerm[] }>('/api/academic-structure/terms');
      setTerms(res.data || []);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Failed to load terms'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (t: AcademicTerm) => {
    setEditingId(t._id);
    setForm({
      name: t.name || '',
      code: t.code || '',
      termType: t.termType || 'semester',
      status: t.status || 'upcoming',
      academicYearLabel: t.academicYearLabel || '',
      legacyTermLabel: t.legacyTermLabel || '',
      legacyYear: t.legacyYear != null ? String(t.legacyYear) : '',
      startDate: toDateInput(t.startDate),
      endDate: toDateInput(t.endDate),
      enrollmentOpenDate: toDateInput(t.enrollmentOpenDate),
      enrollmentCloseDate: toDateInput(t.enrollmentCloseDate),
      gradingPeriodCloseDate: toDateInput(t.gradingPeriodCloseDate),
      finalizeDeadline: toDateInput(t.finalizeDeadline),
    });
    setMessage('');
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      termType: form.termType,
      status: form.status,
      academicYearLabel: form.academicYearLabel.trim(),
      legacyTermLabel: form.legacyTermLabel.trim(),
      legacyYear: form.legacyYear ? Number(form.legacyYear) : null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      enrollmentOpenDate: form.enrollmentOpenDate || null,
      enrollmentCloseDate: form.enrollmentCloseDate || null,
      gradingPeriodCloseDate: form.gradingPeriodCloseDate || null,
      finalizeDeadline: form.finalizeDeadline || null,
    };
    try {
      if (editingId) {
        const { code: _ignoredCode, ...patch } = payload;
        void _ignoredCode;
        await registrarPatch(`/api/academic-structure/terms/${editingId}`, patch);
        setMessage('Term updated');
      } else {
        await registrarPost('/api/academic-structure/terms', payload);
        setMessage('Term created');
      }
      resetForm();
      await load();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Save failed'
      );
    }
  };

  const field = (key: keyof typeof emptyForm, label: string, type = 'text') => (
    <label className={ru.label}>
      {label}
      <input
        type={type}
        className={ru.input}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        required={key === 'name' || key === 'code'}
        disabled={key === 'code' && Boolean(editingId)}
      />
    </label>
  );

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
        className={`${ru.card} grid gap-3 sm:grid-cols-2 lg:grid-cols-3`}
      >
        <h2 className={`${ru.sectionTitle} sm:col-span-2 lg:col-span-3 text-lg`}>
          {editingId ? 'Edit term' : 'Create term'}
        </h2>
        {field('name', 'Name')}
        {field('code', 'Code')}
        <label className={ru.label}>
          Type
          <select
            className={ru.select}
            value={form.termType}
            onChange={(e) => setForm((f) => ({ ...f, termType: e.target.value }))}
          >
            {['semester', 'trimester', 'quarter', 'annual', 'summer', 'custom'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className={ru.label}>
          Status
          <select
            className={ru.select}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            {['upcoming', 'active', 'grading', 'closed', 'archived'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {field('academicYearLabel', 'Academic year label')}
        {field('legacyTermLabel', 'Legacy term label (Fall/Spring…)')}
        {field('legacyYear', 'Legacy year', 'number')}
        {field('startDate', 'Start date', 'date')}
        {field('endDate', 'End date', 'date')}
        {field('enrollmentOpenDate', 'Enrollment open', 'date')}
        {field('enrollmentCloseDate', 'Enrollment close', 'date')}
        {field('gradingPeriodCloseDate', 'Grading period close', 'date')}
        {field('finalizeDeadline', 'Finalize deadline', 'date')}
        <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
          <button type="submit" className={ru.btnPrimary}>
            {editingId ? 'Save changes' : 'Create term'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className={ru.btnSecondary}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <section>
        <h2 className={`${ru.sectionTitle} text-lg mb-2`}>Terms</h2>
        {loading ? (
          <p className={ru.muted}>Loading…</p>
        ) : (
          <ul className={ru.list}>
            {terms.map((t) => (
              <li key={t._id} className={`${ru.listItem} flex flex-wrap justify-between gap-2`}>
                <div>
                  <div className="font-medium">
                    {t.name} <span className="text-gray-500 font-normal">({t.code})</span>
                  </div>
                  <div className={`${ru.muted} mt-0.5`}>
                    {t.status} · {t.termType}
                    {t.enrollmentOpenDate || t.enrollmentCloseDate
                      ? ` · enroll ${toDateInput(t.enrollmentOpenDate) || '—'} → ${toDateInput(t.enrollmentCloseDate) || '—'}`
                      : ''}
                  </div>
                </div>
                <button type="button" className={ru.link} onClick={() => startEdit(t)}>
                  Edit
                </button>
              </li>
            ))}
            {!terms.length && <li className={ru.empty}>No terms yet.</li>}
          </ul>
        )}
      </section>
    </div>
  );
}

export default RegistrarTerms;
