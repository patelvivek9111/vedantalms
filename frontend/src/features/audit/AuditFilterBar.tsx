import React from 'react';
import { ds } from '../../design-system';

export interface AuditFilters {
  search: string;
  category: string;
  severity: string;
}

interface AuditFilterBarProps {
  filters: AuditFilters;
  onChange: (next: AuditFilters) => void;
  categories?: string[];
}

const AuditFilterBar: React.FC<AuditFilterBarProps> = ({ filters, onChange, categories = [] }) => (
  <div className="mb-3 flex flex-wrap gap-2">
    <input
      type="search"
      value={filters.search}
      onChange={(e) => onChange({ ...filters, search: e.target.value })}
      placeholder="Search audit…"
      className={`${ds.input} max-w-xs`}
      aria-label="Search audit entries"
    />
    <select
      value={filters.category}
      onChange={(e) => onChange({ ...filters, category: e.target.value })}
      className={ds.input}
      aria-label="Filter by category"
    >
      <option value="">All categories</option>
      {categories.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
    <select
      value={filters.severity}
      onChange={(e) => onChange({ ...filters, severity: e.target.value })}
      className={ds.input}
      aria-label="Filter by severity"
    >
      <option value="">All severities</option>
      <option value="info">Info</option>
      <option value="warning">Warning</option>
      <option value="critical">Critical</option>
    </select>
  </div>
);

export default AuditFilterBar;
