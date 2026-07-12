import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trash2, ArrowLeft } from 'lucide-react';
import { api } from '../../utils/api';

type Workspace = {
  id: number;
  team_id: number;
  name: string;
  project_root: string;
  created_by: number;
  created_at: string;
  team_name?: string;
  permission?: string;
};

type Permission = {
  id: number;
  username: string;
  dingtalk_nick?: string;
  permission: string;
};

export default function WorkspaceSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [wsRes, permRes] = await Promise.all([
        api.workspaces.get(Number(id)),
        api.workspaces.permissions(Number(id)),
      ]);
      if (wsRes.ok) {
        const data = await wsRes.json();
        setWorkspace(data.workspace);
      }
      if (permRes.ok) {
        const data = await permRes.json();
        setPermissions(data.permissions || []);
      }
    } catch {
      setError('Failed to load workspace');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSetPermission = async (userId: number, permission: string) => {
    setError(null);
    try {
      const res = await api.workspaces.setPermission(Number(id), userId, permission);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update permission');
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update permission');
    }
  };

  const handleDelete = async () => {
    if (!workspace) return;
    if (!confirm(`Delete workspace "${workspace.name}"? This cannot be undone.`)) return;
    setError(null);
    try {
      const res = await api.workspaces.delete(Number(id));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete workspace');
      }
      navigate('/workspaces');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workspace');
    }
  };

  const canManage = workspace?.permission === 'admin';

  if (loading) {
    return <div className="p-6 text-sm text-neutral-400">Loading...</div>;
  }

  if (!workspace) {
    return <div className="p-6 text-sm text-neutral-400">Workspace not found.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <button
        type="button"
        onClick={() => navigate('/workspaces')}
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        Back to workspaces
      </button>

      <h1 className="mb-6 text-xl font-semibold text-neutral-900 dark:text-neutral-100">{workspace.name}</h1>

      {error ? (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {/* Workspace info */}
      <div className="mb-6 space-y-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">Team</span>
          <span className="text-neutral-900 dark:text-neutral-100">{workspace.team_name || `#${workspace.team_id}`}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">Project root</span>
          <span className="break-all text-neutral-900 dark:text-neutral-100">{workspace.project_root}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">Your permission</span>
          <span className="text-neutral-900 dark:text-neutral-100">{workspace.permission || 'read'}</span>
        </div>
      </div>

      {/* Permissions */}
      <h2 className="mb-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">Member Permissions</h2>
      <div className="space-y-1 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
        {permissions.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm">
            <span className="flex-1 truncate text-neutral-700 dark:text-neutral-300">
              {p.dingtalk_nick || p.username}
            </span>
            {canManage ? (
              <select
                value={p.permission}
                onChange={(e) => handleSetPermission(p.id, e.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-600 dark:bg-neutral-900"
              >
                <option value="read">Read</option>
                <option value="write">Write</option>
                <option value="admin">Admin</option>
              </select>
            ) : (
              <span className="text-xs text-neutral-400">{p.permission}</span>
            )}
          </div>
        ))}
        {permissions.length === 0 ? (
          <p className="px-3 py-2 text-sm text-neutral-400">No members with explicit permissions.</p>
        ) : null}
      </div>

      {/* Delete */}
      {canManage ? (
        <div className="mt-6">
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-300 px-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            Delete workspace
          </button>
        </div>
      ) : null}
    </div>
  );
}
