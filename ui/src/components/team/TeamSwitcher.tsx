import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Users, Folder } from 'lucide-react';
import { useTeam } from '../../contexts/TeamContext';

export default function TeamSwitcher() {
  const { teams, workspaces, currentTeam, currentWorkspace, switchTeam, switchWorkspace } = useTeam();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const label = currentWorkspace
    ? currentWorkspace.name
    : currentTeam
      ? currentTeam.name
      : 'Select workspace';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <Folder className="h-3.5 w-3.5 shrink-0 text-neutral-500 dark:text-neutral-400" strokeWidth={1.75} />
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-500" strokeWidth={1.75} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {teams.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-neutral-500 dark:text-neutral-400">
              No teams yet. Create one in the Teams page.
            </div>
          ) : (
            teams.map((team) => (
              <div key={team.id}>
                <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  <Users className="h-3 w-3" strokeWidth={1.75} />
                  {team.name}
                </div>
                {workspaces
                  .filter((w) => w.team_id === team.id)
                  .map((ws) => (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => {
                        switchTeam(team.id);
                        switchWorkspace(ws.id);
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[12.5px] text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    >
                      <Folder className="h-3 w-3 shrink-0 text-neutral-500" strokeWidth={1.75} />
                      <span className="flex-1 truncate">{ws.name}</span>
                      {currentWorkspace?.id === ws.id ? (
                        <span className="text-[10px] text-blue-500">active</span>
                      ) : null}
                    </button>
                  ))}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
