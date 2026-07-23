import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import { getMemoryAuthToken } from '../utils/authToken';
import { MobileAppShell } from '../components/common/MobileAppShell';

type AccountNode = {
  _id: string;
  name: string;
  code: string;
  parentAccountId?: string | null;
  workflowState?: string;
  children?: AccountNode[];
};

function authHeaders() {
  return { Authorization: `Bearer ${getMemoryAuthToken()}` };
}

function AccountBranch({
  node,
  depth,
  onRefresh,
}: {
  node: AccountNode;
  depth: number;
  onRefresh: () => void;
}) {
  const [name, setName] = useState(node.name);
  const [childName, setChildName] = useState('');

  const save = async () => {
    await axios.patch(
      `${API_URL}/api/admin/accounts/${node._id}`,
      { name },
      { headers: authHeaders() }
    );
    onRefresh();
  };

  const addChild = async () => {
    if (!childName.trim()) return;
    await axios.post(
      `${API_URL}/api/admin/accounts`,
      { name: childName.trim(), parentAccountId: node._id },
      { headers: authHeaders() }
    );
    setChildName('');
    onRefresh();
  };

  return (
    <li className="space-y-2">
      <div
        className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2"
        style={{ marginLeft: depth * 16 }}
      >
        <input
          className="flex-1 min-w-[140px] rounded border px-2 py-1 text-sm dark:bg-gray-800"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <span className="text-xs text-gray-500">{node.code}</span>
        <button type="button" onClick={() => void save()} className="text-sm text-blue-600">
          Save
        </button>
      </div>
      <div className="flex gap-2" style={{ marginLeft: depth * 16 + 12 }}>
        <input
          className="rounded border px-2 py-1 text-sm dark:bg-gray-800"
          placeholder="New sub-account name"
          value={childName}
          onChange={(e) => setChildName(e.target.value)}
        />
        <button type="button" onClick={() => void addChild()} className="text-sm text-indigo-600">
          Add child
        </button>
      </div>
      {!!node.children?.length && (
        <ul className="space-y-2">
          {node.children.map((c) => (
            <AccountBranch key={c._id} node={c} depth={depth + 1} onRefresh={onRefresh} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function AdminAccountTree() {
  const [tree, setTree] = useState<AccountNode[]>([]);
  const [error, setError] = useState('');
  const [courseIds, setCourseIds] = useState('');
  const [targetAccountId, setTargetAccountId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await axios.get(`${API_URL}/api/admin/accounts`, { headers: authHeaders() });
      setTree(res.data?.data?.tree || []);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Failed to load account tree'
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const moveCourses = async (e: React.FormEvent) => {
    e.preventDefault();
    const ids = courseIds
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    await axios.post(
      `${API_URL}/api/admin/accounts/move-courses`,
      { accountId: targetAccountId, courseIds: ids },
      { headers: authHeaders() }
    );
    setCourseIds('');
    await load();
  };

  return (
    <MobileAppShell title="Accounts">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex justify-between items-baseline">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Sub-accounts</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Canvas-style account tree for departments and campuses.
            </p>
          </div>
          <Link to="/admin" className="text-sm text-blue-600 hover:underline">
            Admin home
          </Link>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <ul className="space-y-3">
          {tree.map((node) => (
            <AccountBranch key={node._id} node={node} depth={0} onRefresh={load} />
          ))}
        </ul>

        <form onSubmit={moveCourses} className="border rounded-md p-3 space-y-2 text-sm border-gray-200 dark:border-gray-700">
          <h2 className="font-medium">Move courses into a sub-account</h2>
          <input
            className="w-full rounded border px-2 py-1 dark:bg-gray-800"
            placeholder="Target account ID"
            value={targetAccountId}
            onChange={(e) => setTargetAccountId(e.target.value)}
            required
          />
          <input
            className="w-full rounded border px-2 py-1 dark:bg-gray-800"
            placeholder="Course IDs (comma/space separated)"
            value={courseIds}
            onChange={(e) => setCourseIds(e.target.value)}
            required
          />
          <button type="submit" className="rounded bg-indigo-600 text-white px-3 py-1.5">
            Move courses
          </button>
        </form>
      </div>
    </MobileAppShell>
  );
}

export default AdminAccountTree;
