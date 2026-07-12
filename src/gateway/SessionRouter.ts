import type { AgentSession } from "../agent/index.js";
import type { GatewaySessionInfo, ListSessionsInput, ListSessionsResult } from "./protocol/types.js";

export type GatewaySessionContext = {
  sessionKey: string;
  projectKey?: string;
  channelKey: string;
  userId?: string;
  workspaceId?: string;
};

export type GatewaySessionFactory = (context: GatewaySessionContext) => AgentSession | Promise<AgentSession>;
export type GatewaySessionRecreator = (
  context: GatewaySessionContext,
  previousSession: AgentSession,
) => AgentSession | Promise<AgentSession>;

export type SessionRouterOptions = {
  createSession: GatewaySessionFactory;
  recreateSession?: GatewaySessionRecreator;
  listSessions?: (input: ListSessionsInput) => Promise<ListSessionsResult>;
  idleSessionTimeoutMs?: number;
  idleSweepIntervalMs?: number;
  now?: () => Date;
  /**
   * Called (fire-and-forget) when a session is evicted from the router —
   * idle sweep, explicit close, or dirty-recreate. Use this to clean up
   * per-session resources (e.g. per-session MCP runtimes / browser processes).
   */
  onSessionEvict?: (sessionKey: string) => void;
  onSessionIdleEvict?: (sessionKey: string, record: SessionEvictionSnapshot) => void;
};

type SessionRecord = {
  session: AgentSession;
  lastUsedAt: number;
  context: GatewaySessionContext;
  dirtyReason?: string;
};

export type SessionEvictionSnapshot = {
  sessionKey: string;
  lastUsedAt: number;
  context: GatewaySessionContext;
  messageCount?: number;
};

const DEFAULT_IDLE_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_IDLE_SWEEP_INTERVAL_MS = 60 * 1000;

export class SessionRouter {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly inFlightTurns = new Map<string, string>();
  private readonly idleSessionTimeoutMs: number;
  private readonly idleSweepIntervalMs: number;
  private readonly now: () => Date;
  private readonly idleSweepTimer?: ReturnType<typeof setInterval>;
  private isShutdown = false;

  constructor(private readonly options: SessionRouterOptions) {
    this.idleSessionTimeoutMs = options.idleSessionTimeoutMs ?? DEFAULT_IDLE_SESSION_TIMEOUT_MS;
    this.idleSweepIntervalMs = options.idleSweepIntervalMs ?? DEFAULT_IDLE_SWEEP_INTERVAL_MS;
    this.now = options.now ?? (() => new Date());
    if (this.idleSweepIntervalMs > 0) {
      this.idleSweepTimer = setInterval(() => this.sweepIdle(), this.idleSweepIntervalMs);
      this.idleSweepTimer.unref?.();
    }
  }

  async getOrCreate(context: GatewaySessionContext): Promise<AgentSession> {
    this.sweepIdle();
    const mapKey = `${context.userId ?? 'default'}:${context.workspaceId ?? 'default'}:${context.sessionKey}`;
    const cached = this.sessions.get(mapKey);
    if (cached) {
      cached.context = mergeSessionContext(cached.context, context);
      if (cached.dirtyReason && this.options.recreateSession) {
        this.emitSessionEvict(context.sessionKey, cached, "dirty_recreate");
        cached.session = await this.options.recreateSession(cached.context, cached.session);
        cached.dirtyReason = undefined;
      }
      cached.lastUsedAt = this.nowMs();
      return cached.session;
    }

    const session = await this.options.createSession(context);
    this.sessions.set(mapKey, {
      session,
      lastUsedAt: this.nowMs(),
      context,
    });
    return session;
  }

  beginTurn(sessionKey: string, runId: string): boolean {
    this.sweepIdle();
    if (this.inFlightTurns.has(sessionKey)) {
      return false;
    }
    this.inFlightTurns.set(sessionKey, runId);
    return true;
  }

  endTurn(sessionKey: string, runId?: string, userId?: string, workspaceId?: string): void {
    const mapKey = `${userId ?? 'default'}:${workspaceId ?? 'default'}:${sessionKey}`;
    const record = this.sessions.get(mapKey);
    const inFlightRunId = this.inFlightTurns.get(sessionKey);
    if (!runId || inFlightRunId === runId) {
      this.inFlightTurns.delete(sessionKey);
    }
    if (record) {
      record.lastUsedAt = this.nowMs();
    }
  }

  async abort(sessionKey: string, reason?: string, userId?: string, workspaceId?: string): Promise<void> {
    const mapKey = `${userId ?? 'default'}:${workspaceId ?? 'default'}:${sessionKey}`;
    const record = this.sessions.get(mapKey);
    record?.session.abort(reason);
    if (record) {
      record.lastUsedAt = this.nowMs();
    }
  }

  async close(sessionKey: string, userId?: string, workspaceId?: string): Promise<void> {
    const mapKey = `${userId ?? 'default'}:${workspaceId ?? 'default'}:${sessionKey}`;
    const record = this.sessions.get(mapKey);
    if (record && this.sessions.delete(mapKey)) {
      this.emitSessionEvict(sessionKey, record, "closed");
    }
  }

  markAllDirty(reason = "runtime_changed"): number {
    let count = 0;
    for (const record of this.sessions.values()) {
      record.dirtyReason = reason;
      count += 1;
    }
    return count;
  }

  markProjectDirty(projectKey: string, reason = "runtime_changed", userId?: string): number {
    let count = 0;
    for (const record of this.sessions.values()) {
      if (record.context.projectKey !== projectKey) {
        continue;
      }
      if (userId !== undefined && record.context.userId !== userId) {
        continue;
      }
      record.dirtyReason = reason;
      count += 1;
    }
    return count;
  }

  async list(input: ListSessionsInput = {}): Promise<ListSessionsResult> {
    if (this.options.listSessions) {
      return this.options.listSessions(input);
    }

    return {
      sessions: [...this.sessions.entries()].map(([, record]): GatewaySessionInfo => {
        const snapshot = record.session.snapshot();
        return {
          sessionId: snapshot.sessionId,
          sessionKey: record.context.sessionKey,
          summary: snapshot.messages
            .flatMap((message) => message.content)
            .find((block) => block.type === "text")
            ?.text ?? record.context.sessionKey,
          lastModified: record.lastUsedAt,
        };
      }),
    };
  }

  sessionCount(): number {
    this.sweepIdle();
    return this.sessions.size;
  }

  cachedSessionCount(): number {
    return this.sessions.size;
  }

  snapshotSession(sessionKey: string, userId?: string, workspaceId?: string): ReturnType<AgentSession["snapshot"]> | undefined {
    const mapKey = `${userId ?? 'default'}:${workspaceId ?? 'default'}:${sessionKey}`;
    return this.sessions.get(mapKey)?.session.snapshot();
  }

  shutdown(): void {
    if (this.isShutdown) return;
    this.isShutdown = true;
    if (this.idleSweepTimer) {
      clearInterval(this.idleSweepTimer);
    }
    for (const [, record] of this.sessions) {
      this.emitSessionEvict(record.context.sessionKey, record, "shutdown");
    }
    this.sessions.clear();
    this.inFlightTurns.clear();
  }

  /**
   * Returns true when at least one *user* turn (not always-on / cron) is
   * in flight for the given project.  Used by the Always-On scheduler to
   * implement the `agent_busy` gate.
   */
  hasActiveUserTurn(projectKey: string, userId?: string): boolean {
    for (const record of this.sessions.values()) {
      const sessionKey = record.context.sessionKey;
      if (!this.inFlightTurns.has(sessionKey)) continue;
      if (sessionKey.startsWith("always-on/")) continue;
      if (sessionKey.startsWith("cron:")) continue;
      if (record.context.projectKey !== projectKey) continue;
      if (userId !== undefined && record.context.userId !== userId) continue;
      return true;
    }
    return false;
  }

  private sweepIdle(): void {
    if (this.isShutdown) return;
    const now = this.nowMs();
    for (const [mapKey, record] of this.sessions) {
      if (this.inFlightTurns.has(record.context.sessionKey)) {
        continue;
      }
      if (now - record.lastUsedAt > this.idleSessionTimeoutMs) {
        this.sessions.delete(mapKey);
        this.emitSessionEvict(record.context.sessionKey, record, "idle");
      }
    }
  }

  private emitSessionEvict(
    sessionKey: string,
    record: SessionRecord,
    reason: "idle" | "closed" | "dirty_recreate" | "shutdown",
  ): void {
    this.options.onSessionEvict?.(sessionKey);
    if (reason === "idle") {
      this.options.onSessionIdleEvict?.(sessionKey, snapshotEvictedSession(sessionKey, record));
    }
  }

  private nowMs(): number {
    return this.now().getTime();
  }
}

function snapshotEvictedSession(sessionKey: string, record: SessionRecord): SessionEvictionSnapshot {
  let messageCount: number | undefined;
  try {
    messageCount = record.session.snapshot().messages.length;
  } catch {
    messageCount = undefined;
  }
  return {
    sessionKey,
    lastUsedAt: record.lastUsedAt,
    context: { ...record.context },
    ...(messageCount !== undefined ? { messageCount } : {}),
  };
}

function mergeSessionContext(
  current: GatewaySessionContext,
  next: GatewaySessionContext,
): GatewaySessionContext {
  return {
    sessionKey: next.sessionKey,
    channelKey: next.channelKey || current.channelKey,
    projectKey: current.projectKey ?? next.projectKey,
    userId: next.userId ?? current.userId,
    workspaceId: next.workspaceId ?? current.workspaceId,
  };
}
