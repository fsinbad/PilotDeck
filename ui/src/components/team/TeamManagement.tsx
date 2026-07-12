import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Users as UsersIcon } from 'lucide-react';
import { api } from '../../utils/api';
import { useTeam } from '../../contexts/TeamContext';

type Member = {
  id: number;
  username: string;
  dingtalk_nick?: string;
  dingtalk_avatar?: string;
  role: string;
  joined_at: string;
};

type User = {
  id: number;
  username: string;
};

export default function TeamManagement() {
  const navigate = useNavigate();
  const { teams, refreshTeams } = useTeam();
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [addMemberRole, setAddMemberRole] = useState('member');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load all users for the add-member dropdown
    api.get('/users').then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data.users || []);
      }
    }).catch(() => {});
  }, []);

  const loadMembers = useCallback(async (teamId: number) => {
    try {
      const res = await api.teams.get(teamId);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch {
      setMembers([]);
    }
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      loadMembers(selectedTeamId);
    } else {
      setMembers([]);
    }
  }, [selectedTeamId, loadMembers]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setError(null);
    try {
      const res = await api.teams.create(newTeamName.trim());
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create team');
      }
      setNewTeamName('');
      await refreshTeams();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeamId || !addMemberUserId) return;
    setError(null);
    try {
      const res = await api.teams.addMember(selectedTeamId, Number(addMemberUserId), addMemberRole);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to add member');
      }
      setAddMemberUserId('');
      await loadMembers(selectedTeamId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!selectedTeamId) return;
    setError(null);
    try {
      const res = await api.teams.removeMember(selectedTeamId, userId);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to remove member');
      }
      await loadMembers(selectedTeamId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-xl font-semibold text-neutral-900 dark:text-neutral-100">Teams</h1>

      {error ? (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {/* Create team */}
      <div className="mb-8 flex items-center gap-2">
        <input
          type="text"
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          placeholder="New team name"
          className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTeam(); }}
        />
        <button
          type="button"
          onClick={handleCreateTeam}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Create
        </button>
      </div>

      {/* Team list */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">Your Teams</h2>
          {teams.length === 0 ? (
            <p className="text-sm text-neutral-400">No teams yet.</p>
          ) : (
            <div className="space-y-1">
              {teams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    selectedTeamId === team.id
                      ? 'bg-neutral-200/70 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                      : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }`}
                >
                  <UsersIcon className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={1.75} />
                  <span className="flex-1 truncate">{team.name}</span>
                  <span className="text-[11px] text-neutral-400">{team.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Members */}
        <div>
          <h2 className="mb-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">Members</h2>
          {!selectedTeamId ? (
            <p className="text-sm text-neutral-400">Select a team to view members.</p>
          ) : (
            <>
              <div className="space-y-1">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm">
                    <span className="flex-1 truncate text-neutral-700 dark:text-neutral-300">
                      {m.dingtalk_nick || m.username}
                    </span>
                    <span className="text-[11px] text-neutral-400">{m.role}</span>
                    {m.role !== 'owner' ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.id)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Add member */}
              <div className="mt-3 flex items-center gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                <select
                  value={addMemberUserId}
                  onChange={(e) => setAddMemberUserId(e.target.value)}
                  className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900"
                >
                  <option value="">Select user...</option>
                  {allUsers
                    .filter((u) => !members.some((m) => m.id === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                </select>
                <select
                  value={addMemberRole}
                  onChange={(e) => setAddMemberRole(e.target.value)}
                  className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddMember}
                  disabled={!addMemberUserId}
                  className="inline-flex h-8 items-center rounded-md bg-neutral-900 px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                >
                  Add
                </button>
              </div>

              <button
                type="button"
                onClick={() => navigate('/workspaces')}
                className="mt-4 text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                View team workspaces →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
