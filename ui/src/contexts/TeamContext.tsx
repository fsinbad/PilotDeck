import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from '../utils/api';

export type Team = {
  id: number;
  name: string;
  owner_id: number;
  created_at: string;
  role: string;
};

export type Workspace = {
  id: number;
  team_id: number;
  name: string;
  project_root: string;
  created_by: number;
  created_at: string;
  team_name?: string;
  permission?: string;
};

type TeamContextValue = {
  teams: Team[];
  workspaces: Workspace[];
  currentTeam: Team | null;
  currentWorkspace: Workspace | null;
  switchTeam: (teamId: number) => void;
  switchWorkspace: (workspaceId: number) => void;
  refreshTeams: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  loading: boolean;
};

const TeamContext = createContext<TeamContextValue | null>(null);

const STORAGE_KEY_TEAM = 'nukemai-current-team-id';
const STORAGE_KEY_WORKSPACE = 'nukemai-current-workspace-id';

export function TeamProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentTeamId, setCurrentTeamId] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_TEAM);
    return stored ? Number(stored) : null;
  });
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_WORKSPACE);
    return stored ? Number(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  const refreshTeams = useCallback(async () => {
    try {
      const res = await api.teams.list();
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
      }
    } catch {
      // non-fatal
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const res = await api.workspaces.list();
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces || []);
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await Promise.all([refreshTeams(), refreshWorkspaces()]);
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [refreshTeams, refreshWorkspaces]);

  const switchTeam = useCallback((teamId: number) => {
    setCurrentTeamId(teamId);
    localStorage.setItem(STORAGE_KEY_TEAM, String(teamId));
  }, []);

  const switchWorkspace = useCallback((workspaceId: number) => {
    setCurrentWorkspaceId(workspaceId);
    localStorage.setItem(STORAGE_KEY_WORKSPACE, String(workspaceId));
  }, []);

  const currentTeam = teams.find((t) => t.id === currentTeamId) ?? null;
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId) ?? null;

  const value: TeamContextValue = {
    teams,
    workspaces,
    currentTeam,
    currentWorkspace,
    switchTeam,
    switchWorkspace,
    refreshTeams,
    refreshWorkspaces,
    loading,
  };

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) {
    throw new Error('useTeam must be used within TeamProvider');
  }
  return ctx;
}
