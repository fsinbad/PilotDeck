import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users as UsersIcon, BarChart3, ScrollText, Settings, Trash2, ArrowLeft } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../auth';

type Tab = 'users' | 'usage' | 'audit' | 'settings';

type User = {
  id: number;
  username: string;
  created_at: string;
  last_login: string | null;
  is_active: number;
  role: string;
  dingtalk_nick?: string;
};

type AuditLog = {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
};

type UsageStat = {
  date: string;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type TopUser = {
  user_id: number;
  username: string | null;
  total_tokens: number;
};

type CurrentUserUsage = {
  daily: number;
  monthly: number;
  quota: { daily_limit: number | null; monthly_limit: number | null };
  remaining: { daily: number | null; monthly: number | null };
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('users');

  const isAdmin = user && (user.role === 'admin' || user.id === 1);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
          Admin access required.
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof UsersIcon }[] = [
    { key: 'users', label: 'Users', icon: UsersIcon },
    { key: 'usage', label: 'Usage', icon: BarChart3 },
    { key: 'audit', label: 'Audit', icon: ScrollText },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <Shield className="h-5 w-5 text-neutral-500" strokeWidth={1.75} />
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Admin Dashboard</h1>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'usage' && <UsageTab />}
      {activeTab === 'audit' && <AuditTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  );
}

// ===== Users Tab =====
function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [usageMap, setUsageMap] = useState<Record<number, { daily: number; monthly: number }>>({});

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.users.list();
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Load usage for each user
  useEffect(() => {
    if (users.length === 0) return;
    Promise.all(
      users.map(async (u) => {
        try {
          const res = await api.usage.userUsage(u.id);
          if (!res.ok) return null;
          const data = await res.json();
          return [u.id, { daily: data.daily || 0, monthly: data.monthly || 0 }] as const;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      const map: Record<number, { daily: number; monthly: number }> = {};
      for (const r of results) {
        if (r) map[r[0]] = r[1];
      }
      setUsageMap(map);
    });
  }, [users]);

  const handleToggleStatus = async (userId: number, currentActive: boolean) => {
    setError(null);
    try {
      const res = await api.users.updateStatus(userId, !currentActive);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update status');
      }
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    setError(null);
    try {
      const res = await api.users.delete(userId);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete user');
      }
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
              <th className="px-4 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">ID</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">Username</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">Role</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">Status</th>
              <th className="px-4 py-2 text-right font-medium text-neutral-500 dark:text-neutral-400">Daily Tokens</th>
              <th className="px-4 py-2 text-right font-medium text-neutral-500 dark:text-neutral-400">Monthly Tokens</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/50">
                <td className="px-4 py-2 text-neutral-500">{u.id}</td>
                <td className="px-4 py-2 text-neutral-900 dark:text-neutral-100">{u.dingtalk_nick || u.username}</td>
                <td className="px-4 py-2">
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(u.id, u.is_active === 1)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.is_active
                        ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500'
                    }`}
                  >
                    {u.is_active ? 'Active' : 'Disabled'}
                  </button>
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                  {(usageMap[u.id]?.daily || 0).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                  {(usageMap[u.id]?.monthly || 0).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  {u.id !== 1 && (
                    <button
                      type="button"
                      onClick={() => handleDelete(u.id)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== Usage Tab =====
function UsageTab() {
  const [stats, setStats] = useState<UsageStat[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [currentUsage, setCurrentUsage] = useState<CurrentUserUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.usage.history({}).then(async (r) => r.ok ? (await r.json()).stats : []).catch(() => []),
      api.usage.topUsers(10).then(async (r) => r.ok ? (await r.json()).topUsers : []).catch(() => []),
      api.usage.current().then(async (r) => r.ok ? await r.json() : null).catch(() => null),
    ]).then(([s, tu, cu]) => {
      setStats(s);
      setTopUsers(tu);
      setCurrentUsage(cu);
    }).catch(() => setError('Failed to load usage data'));
  }, []);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Current usage summary */}
      {currentUsage && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Daily Usage" value={currentUsage.daily.toLocaleString()} />
          <StatCard label="Monthly Usage" value={currentUsage.monthly.toLocaleString()} />
          <StatCard
            label="Daily Limit"
            value={currentUsage.quota.daily_limit != null ? currentUsage.quota.daily_limit.toLocaleString() : 'Unlimited'}
          />
          <StatCard
            label="Monthly Limit"
            value={currentUsage.quota.monthly_limit != null ? currentUsage.quota.monthly_limit.toLocaleString() : 'Unlimited'}
          />
        </div>
      )}

      {/* Top users by usage */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">Top Users by Token Usage</h3>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
                <th className="px-4 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">User</th>
                <th className="px-4 py-2 text-right font-medium text-neutral-500 dark:text-neutral-400">Total Tokens</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-4 text-center text-neutral-400">No usage data yet.</td></tr>
              ) : (
                topUsers.map((tu) => (
                  <tr key={tu.user_id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/50">
                    <td className="px-4 py-2 text-neutral-900 dark:text-neutral-100">{tu.username || `User ${tu.user_id}`}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-700 dark:text-neutral-300">{tu.total_tokens.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage by day/model */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">Usage History (by Day & Model)</h3>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
                <th className="px-4 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">Date</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">Model</th>
                <th className="px-4 py-2 text-right font-medium text-neutral-500 dark:text-neutral-400">Prompt</th>
                <th className="px-4 py-2 text-right font-medium text-neutral-500 dark:text-neutral-400">Completion</th>
                <th className="px-4 py-2 text-right font-medium text-neutral-500 dark:text-neutral-400">Total</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-4 text-center text-neutral-400">No usage history yet.</td></tr>
              ) : (
                stats.map((s, i) => (
                  <tr key={i} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/50">
                    <td className="px-4 py-2 text-neutral-900 dark:text-neutral-100">{s.date}</td>
                    <td className="px-4 py-2 text-neutral-500">{s.model || '-'}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-700 dark:text-neutral-300">{s.prompt_tokens.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-700 dark:text-neutral-300">{s.completion_tokens.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-neutral-900 dark:text-neutral-100">{s.total_tokens.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">{value}</div>
    </div>
  );
}

// ===== Audit Tab =====
function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ userId: '', action: '' });
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const loadLogs = useCallback(async (off = 0) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { limit: String(limit), offset: String(off) };
      if (filters.userId) params.userId = filters.userId;
      if (filters.action) params.action = filters.action;
      const res = await api.audit.logs(params);
      if (!res.ok) throw new Error('Failed to load audit logs');
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setOffset(off);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadLogs(0);
  }, [loadLogs]);

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="User ID"
          value={filters.userId}
          onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
          className="w-28 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900"
        />
        <input
          type="text"
          placeholder="Action (e.g. login)"
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          className="w-44 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900"
        />
        <button
          type="button"
          onClick={() => loadLogs(0)}
          className="inline-flex h-8 items-center rounded-md bg-neutral-900 px-3 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          Filter
        </button>
        <span className="text-xs text-neutral-400">{total} total logs</span>
      </div>

      {/* Logs table */}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
              <th className="px-3 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">Time</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">User</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">Action</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">Resource</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">IP</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-4 text-center text-neutral-400">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-4 text-center text-neutral-400">No audit logs found.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/50">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">{log.created_at}</td>
                  <td className="px-3 py-2 text-neutral-900 dark:text-neutral-100">{log.username || `User ${log.user_id}` || '-'}</td>
                  <td className="px-3 py-2">
                    <code className="text-xs text-neutral-700 dark:text-neutral-300">{log.action}</code>
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">
                    {log.resource_type ? `${log.resource_type}:${log.resource_id || ''}` : '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">{log.ip_address || '-'}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-xs text-neutral-500" title={log.details || ''}>
                    {log.details || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadLogs(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="rounded-md border border-neutral-300 px-3 py-1 text-sm text-neutral-700 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-300"
          >
            Previous
          </button>
          <span className="text-xs text-neutral-400">
            {offset + 1}-{Math.min(offset + limit, total)} of {total}
          </span>
          <button
            type="button"
            onClick={() => loadLogs(offset + limit)}
            disabled={offset + limit >= total}
            className="rounded-md border border-neutral-300 px-3 py-1 text-sm text-neutral-700 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-300"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ===== Settings Tab =====
function SettingsTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<number, { dailyLimit: string; monthlyLimit: string; concurrency: string }>>({});
  const [concurrencyMap, setConcurrencyMap] = useState<Record<number, number>>({});

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.users.list();
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data.users || []);
      // Load concurrency limits for each user
      const cMap: Record<number, number> = {};
      await Promise.all(
        (data.users || []).map(async (u: User) => {
          try {
            const cRes = await api.usage.getConcurrency(u.id);
            if (cRes.ok) {
              const cData = await cRes.json();
              cMap[u.id] = cData.limit?.max_concurrent_sessions ?? 3;
            }
          } catch { /* ignore */ }
        })
      );
      setConcurrencyMap(cMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSaveQuota = async (userId: number) => {
    const edit = editing[userId];
    if (!edit) return;
    setError(null);
    setSuccess(null);
    try {
      const quotas: { dailyLimit?: number; monthlyLimit?: number } = {};
      if (edit.dailyLimit.trim() !== '') quotas.dailyLimit = parseInt(edit.dailyLimit, 10);
      if (edit.monthlyLimit.trim() !== '') quotas.monthlyLimit = parseInt(edit.monthlyLimit, 10);
      const res = await api.usage.setQuota(userId, quotas);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to set quota');
      }
      setEditing((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setSuccess(`Quota updated for user ${userId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set quota');
    }
  };

  const handleSaveConcurrency = async (userId: number, value: number) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await api.usage.setConcurrency(userId, value);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to set concurrency limit');
      }
      setConcurrencyMap((prev) => ({ ...prev, [userId]: value }));
      setSuccess(`Concurrency limit updated for user ${userId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set concurrency limit');
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400">
          {success}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
              <th className="px-4 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">User</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">Daily Limit</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">Monthly Limit</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">Max Sessions</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500 dark:text-neutral-400"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const edit = editing[u.id];
              return (
                <tr key={u.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/50">
                  <td className="px-4 py-2 text-neutral-900 dark:text-neutral-100">{u.dingtalk_nick || u.username}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      placeholder="Unlimited"
                      value={edit?.dailyLimit ?? ''}
                      onChange={(e) => setEditing((prev) => ({
                        ...prev,
                        [u.id]: { dailyLimit: e.target.value, monthlyLimit: edit?.monthlyLimit ?? '', concurrency: edit?.concurrency ?? '' },
                      }))}
                      className="w-24 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-900"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      placeholder="Unlimited"
                      value={edit?.monthlyLimit ?? ''}
                      onChange={(e) => setEditing((prev) => ({
                        ...prev,
                        [u.id]: { dailyLimit: edit?.dailyLimit ?? '', monthlyLimit: e.target.value, concurrency: edit?.concurrency ?? '' },
                      }))}
                      className="w-24 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-900"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={1}
                      defaultValue={concurrencyMap[u.id] ?? 3}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (Number.isFinite(val) && val >= 1 && val !== (concurrencyMap[u.id] ?? 3)) {
                          handleSaveConcurrency(u.id, val);
                        }
                      }}
                      className="w-20 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-900"
                    />
                  </td>
                  <td className="px-4 py-2">
                    {edit && (
                      <button
                        type="button"
                        onClick={() => handleSaveQuota(u.id)}
                        className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                      >
                        Save Quota
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-neutral-400">Leave limits blank for unlimited. Max sessions defaults to 3.</p>
    </div>
  );
}
