import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Settings as SettingsIcon, Folder } from 'lucide-react';
import { api } from '../../utils/api';
import { useTeam } from '../../contexts/TeamContext';

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

export default function WorkspaceList() {
  const navigate = useNavigate();
  const { teams, workspaces, refreshWorkspaces } = useTeam();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTeamId, setNewTeamId] = useState('');
  const [newProjectRoot, setNewProjectRoot] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!newName.trim() || !newProjectRoot.trim() || !newTeamId) {
      setError('All fields are required');
      return;
    }
    try {
      const res = await api.workspaces.create(Number(newTeamId), newName.trim(), newProjectRoot.trim());
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create workspace');
      }
      setNewName('');
      setNewProjectRoot('');
      setNewTeamId('');
      setShowCreate(false);
      await refreshWorkspaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Workspaces</h1>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          New Workspace
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {showCreate ? (
        <div className="mb-6 space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Team</label>
            <select
              value={newTeamId}
              onChange={(e) => setNewTeamId(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
            >
              <option value="">Select team...</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Workspace name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
              placeholder="e.g. frontend-dev"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Project root path</label>
            <input
              type="text"
              value={newProjectRoot}
              onChange={(e) => setNewProjectRoot(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
              placeholder="/path/to/project"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900"
            >
              Create
            </button>
          </div>
        </div>
      ) : null}

      {workspaces.length === 0 ? (
        <p className="text-sm text-neutral-400">No workspaces yet. Create one to get started.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="rounded-lg border border-neutral-200 p-4 transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
            >
              <div className="flex items-start gap-3">
                <Folder className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{ws.name}</h3>
                    {ws.permission ? (
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                        {ws.permission}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">{ws.project_root}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-400">
                    Team: {ws.team_name || `#${ws.team_id}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/workspaces/${ws.id}/settings`)}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
                >
                  <SettingsIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
