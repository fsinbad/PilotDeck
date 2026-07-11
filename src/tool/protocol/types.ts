import type {
  CanonicalModelEvent,
  CanonicalModelRequest,
  CanonicalToolCall,
  CanonicalUsage,
  MultimodalConstraints,
} from "../../model/index.js";
import type {
  PermissionContext,
  PermissionDecision,
  PermissionMode,
  PermissionResult,
} from "../../permission/index.js";
import type { AgentRunMode } from "../../agent/protocol/input.js";
import type { NukemAIToolAuditRecorder } from "../audit/ToolAuditRecorder.js";
import type { NukemAIElicitationChannel } from "../elicitation/NukemAIElicitationChannel.js";
import type { NukemAIToolInputSchema, NukemAIToolValidationResult } from "./schema.js";

/**
 * File-history sink used by `edit_file` / `write_file` to backup files
 * before mutation (C4 §6.4 / F1 trackEdit). Wired in by the agent loop
 * when a `FileHistoryStore` is available; absent for stand-alone tool
 * runtimes (tests, scripted invocations) — affected tools tolerate the
 * missing sink and proceed without backups.
 */
export type NukemAIToolFileHistorySink = {
  trackEdit(filePath: string, messageId: string): Promise<void>;
};

/**
 * Minimal model client surface tools may use to issue secondary model calls
 * (e.g. `agent` subagent prompts, `web_fetch` content extraction). Mirrors
 * `AgentModelRuntime` but lives in the tool protocol to avoid a tool→agent
 * dependency cycle.
 */
export type NukemAIToolModelClient = {
  stream(request: CanonicalModelRequest, signal?: AbortSignal): AsyncIterable<CanonicalModelEvent>;
};

/**
 * Subagent fork API exposed to the `agent` tool by the AgentLoop. Lives in
 * the tool protocol layer so the tool implementation doesn't reach into
 * `agent/sub/*` directly (which would invert the dependency).
 *
 * `depth` reports the *current* subagent fork depth (0 = top-level agent;
 * each `agent` invocation hands the next-level loop `depth + 1`).
 * `maxSubagentDepth` is the cap (default 1) — the `agent` tool raises
 * `subagent_depth_exceeded` when `depth >= maxSubagentDepth`.
 */
export type NukemAISubagentForkApi = {
  depth: number;
  maxSubagentDepth: number;
  listDefinitions(): { id: string; description: string }[];
  isAllowedDefinition(id: string): boolean;
  fork(args: {
    definitionId: string;
    directive: string;
    subagentId: string;
    toolCallId?: string;
    abortSignal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<{
    markdown: string;
    usage: CanonicalUsage;
    turns: number;
    durationMs: number;
    parsed?: Record<string, string>;
  }>;
};

export type NukemAIToolKind =
  | "filesystem"
  | "shell"
  | "network"
  | "mcp"
  | "session"
  | "agent"
  | "structured_output"
  | "custom";

export type NukemAIToolResultContent =
  | { type: "text"; text: string }
  | { type: "json"; value: unknown }
  | { type: "image"; mimeType: string; data: string; bytes?: number; detail?: "auto" | "low" | "high" }
  | { type: "pdf"; mimeType: "application/pdf"; data: string; bytes: number; pages?: number }
  | { type: "file"; path: string; mimeType?: string; description?: string };

export type NukemAIReadFileStateEntry = {
  mtimeMs: number;
  kind: "text" | "image" | "pdf" | "notebook";
  offset?: number;
  limit?: number;
  pages?: string;
};

export type NukemAIReadFileStateMap = Map<string, NukemAIReadFileStateEntry>;

export type NukemAIWriteSnapshotEntry = {
  absolutePath: string;
  mtimeMs: number;
  contentHash: string;
  /** Set when the snapshot was seeded by a ranged read (offset/limit). */
  offset?: number;
  /** Set when the snapshot was seeded by a ranged read (offset/limit). */
  limit?: number;
};

export type NukemAIWriteSnapshotMap = Map<string, NukemAIWriteSnapshotEntry>;

export type NukemAIFileUpdateNotification = {
  absolutePath: string;
  relativePath: string;
  root: string;
  content: string;
  previousContent: string | null;
};

export type NukemAIFileUpdateNotifier = {
  didChange?(update: NukemAIFileUpdateNotification): Promise<void> | void;
  didSave?(update: NukemAIFileUpdateNotification): Promise<void> | void;
};

export type NukemAIToolSupplementalMessage = {
  role: "user";
  content: NukemAIToolResultContent[];
  isMeta?: boolean;
};

export type NukemAIToolExecutionOutput<Output = unknown> = {
  content: NukemAIToolResultContent[];
  supplementalMessages?: NukemAIToolSupplementalMessage[];
  data?: Output;
  metadata?: Record<string, unknown>;
};

export type NukemAIToolAvailability =
  | { ok: true }
  | { ok: false; code: "setup_required" | "unavailable" | "failed_check"; reason: string };

export type NukemAIToolAvailabilityContext = {
  cwd: string;
  env?: NodeJS.ProcessEnv;
};

/**
 * Tool progress event emitted via `NukemAIToolRuntimeContext.progress`.
 * The sink is fire-and-forget — progress events MUST NOT replace the final
 * `tool_result`, MUST NOT enter the durable transcript, and MAY be dropped
 * by the caller without affecting tool correctness.
 */
export type NukemAIToolProgressEvent = {
  type: "tool_progress";
  sessionId: string;
  turnId: string;
  toolCallId: string;
  toolName: string;
  /** Short human-friendly progress message (e.g. "stdout: ..."). */
  message: string;
  /** Optional payload (chunk text, byte counts, partial output, etc.). */
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type NukemAIToolProgressSink = (event: NukemAIToolProgressEvent) => void;

export type NukemAITodoItem = {
  id?: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority?: string;
};

export type NukemAITodoUpdate = {
  id?: string;
  content?: string;
  status?: NukemAITodoItem["status"];
  priority?: string;
};

export type NukemAITodoDiagnostics = {
  writeCount: number;
  todoCount: number;
  activeCount: number;
  completedCount: number;
  cancelledCount: number;
  largeRewriteCount: number;
  deletedOpenItemCount: number;
  completedWithoutActiveCount: number;
  lastWrite?: {
    mode: "markdown" | "structured";
    merge: boolean;
    reason?: string;
    addedCount: number;
    removedCount: number;
    changedCount: number;
    deletedOpenItemCount: number;
    largeRewrite: boolean;
    allCompleted: boolean;
  };
};

export type NukemAITodoWriteHistoryEntry = {
  createdAt: string;
  mode: "markdown" | "structured";
  merge: boolean;
  reason?: string;
  markdown?: string;
  todos: NukemAITodoItem[];
  diagnostics: NukemAITodoDiagnostics;
};

export type NukemAIPlanTodoStateSnapshot = {
  approvedPlan?: string;
  requiresInitialization: boolean;
  toolCallsSinceLastTodoWrite: number;
  lastMarkdown?: string;
  todos: NukemAITodoItem[];
  activeTodos: NukemAITodoItem[];
  todoHistory: NukemAITodoWriteHistoryEntry[];
  todoDiagnostics: NukemAITodoDiagnostics;
};

export type NukemAIPlanTodoStateHandle = {
  getSnapshot(): NukemAIPlanTodoStateSnapshot;
  markPlanApproved(plan: string): void;
  recordTodoWrite(markdown: string, todos: NukemAITodoItem[], options?: { reason?: string }): NukemAITodoItem[];
  writeTodos(todos: NukemAITodoUpdate[], options?: { markdown?: string; merge?: boolean; reason?: string }): NukemAITodoItem[];
  markToolProgressChanged(toolName: string): void;
  buildPromptAddendum(): string | undefined;
  blockingMessageFor(toolName: string, isReadOnly: boolean): string | undefined;
};

export type NukemAIToolRuntimeContext = {
  sessionId: string;
  turnId: string;
  cwd: string;
  abortSignal?: AbortSignal;
  subagentTimeoutMs?: number;
  /** The tool call ID assigned by the model for the current invocation. */
  currentToolCallId?: string;
  /**
   * Optional model/provider-specific aliases for emitted tool names. These are
   * used only when the emitted name is not already registered.
   */
  toolAliases?: Record<string, string>;
  permissionMode: PermissionMode;
  permissionContext: PermissionContext;
  auditRecorder?: NukemAIToolAuditRecorder;
  /**
   * The final allow decision for the current tool call, populated by
   * ToolRuntime after permission checks pass and before tool execution.
   * Direct tool invocations leave this unset.
   */
  currentPermissionDecision?: Extract<PermissionDecision, { type: "allow" }>;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
  maxResultBytes?: number;
  runMode?: AgentRunMode;
  /**
   * Optional streaming progress sink. Tools that produce incremental output
   * (e.g. `bash` stdout/stderr chunks) can call this to emit progress events
   * before the final result lands. Absent by default; callers opt in by
   * supplying a sink.
   */
  progress?: NukemAIToolProgressSink;
  /**
   * Optional model client for tools that need to issue secondary model calls
   * (e.g. `agent` subagent prompts, `web_fetch` content extraction). Absent
   * when the caller didn't provide one — affected tools must report
   * `unsupported_tool` with a clear hint instead of failing silently.
   */
  model?: NukemAIToolModelClient;
  /**
   * Optional user-elicitation channel used by `ask_user_question` and any
   * tool that requests a synchronous user answer. The host (Gateway / TUI /
   * CLI / Feishu) wires this in. Absent when no UI is connected; affected
   * tools must report `unsupported_tool`.
   */
  elicitation?: NukemAIElicitationChannel;
  /**
   * Optional file-history sink (C4). When provided, `edit_file` /
   * `write_file` call `trackEdit(filePath, messageId)` *before* mutating,
   * so a later `nukemai rewind` can restore the prior content. Absent
   * for stand-alone runtimes; tools tolerate the absence by simply
   * skipping backup capture (intentional — never block the edit on
   * snapshot infrastructure).
   */
  fileHistory?: NukemAIToolFileHistorySink;
  /**
   * Optional opaque "message id" the file-history sink uses to group
   * snapshots. Set by the agent loop per user turn (typically the user
   * message UUID). When `fileHistory` is set but `messageId` is missing,
   * tools fall back to `turnId` so trackEdit still runs.
   */
  messageId?: string;
  /**
   * Subagent fork depth (C2 §6.2 / S?). Top-level agent runs at depth 0;
   * subagent forks pass `depth + 1`. The `agent` tool throws
   * `subagent_depth_exceeded` when invoked at `depth >= maxSubagentDepth`
   * (default 1, blocking nested forks). Absent → treated as 0.
   */
  subagentDepth?: number;
  /**
   * Subagent fork API (C2 §6.2). Wired in by the AgentLoop when the parent
   * supports forking; absent for stand-alone tool runtimes (tests). When
   * absent, the `agent` tool falls back to the legacy single-shot model
   * call so unit tests still work.
   */
  subagent?: NukemAISubagentForkApi;
  /**
   * Plan directory handle for plan-mode tools (`enter_plan_mode` /
   * `exit_plan_mode`). When plan mode is active the model may create and
   * edit markdown files under this directory, then submit one explicitly
   * via `exit_plan_mode(plan_file_path)`. Absent when PlanFileManager is
   * not configured (e.g. headless / test runtimes).
   */
  planDirectory?: {
    path: string;
    resolve(filePath: string): string | undefined;
    read(filePath: string): string | undefined;
  };
  /**
   * Optional session-scoped todo state used by plan execution flows. The
   * `todo_write` tool records checklist updates here; the runtime can enforce
   * that side-effecting tools do not run before the checklist is initialized
   * or refreshed after progress changes.
   */
  planTodo?: NukemAIPlanTodoStateHandle;
  /**
   * Multimodal constraints of the model driving this agent session.
   * Absent when the model config doesn't declare multimodal capabilities
   * (text-only). Tools use this to decide whether to return rich content
   * (e.g. base64 images) or a text-only fallback description.
   */
  modelMultimodal?: MultimodalConstraints;
  /**
   * Current max output tokens for this session's model. Surfaced in
   * validation error hints so the model can reason about output budget
   * when planning multi-step writes.
   */
  maxOutputTokens?: number;
  /**
   * True when the model's response was truncated due to output token limit
   * (finishReason === "length"). Tools use this to produce accurate error
   * messages — e.g. distinguishing "parameter missing because output was
   * truncated" from "model failed to provide required parameter".
   */
  outputTruncated?: boolean;
  /**
   * Optional recursive tool executor used by higher-level tools such as
   * `execute_code` to dispatch nested tool calls through the same ToolRuntime
   * permission, lifecycle, audit, and result-limiting path as normal model
   * tool calls. Hosts that execute tools directly may omit this; dependent
   * tools report `unsupported_tool` instead of bypassing safety checks.
   */
  executeTool?: (
    call: NukemAIToolCall,
    contextPatch?: Partial<NukemAIToolRuntimeContext>,
  ) => Promise<import("./result.js").NukemAIToolResult>;
  /**
   * Optional session-scoped cache for read_file de-duplication. The agent loop
   * keeps the map stable across turns so repeated reads of an unchanged file
   * can return a lightweight stub instead of re-injecting the full payload.
   */
  readFileState?: NukemAIReadFileStateMap;
  /**
   * Session-scoped exact file paths that read_file may read even when they are
   * outside the workspace. Used for registered IM attachments only.
   */
  allowedReadFiles?: string[];
  /**
   * Optional session-scoped map of full-text reads that may authorize
   * subsequent write_file overwrites. Only complete text reads populate this.
   */
  writeSnapshots?: NukemAIWriteSnapshotMap;
  /**
   * Optional sink that propagates successful file writes to host integrations
   * such as LSP bridges or editor diff views.
   */
  fileUpdateNotifier?: NukemAIFileUpdateNotifier;
};

export type NukemAIToolDefinition<Input = unknown, Output = unknown> = {
  name: string;
  aliases?: string[];
  title?: string;
  description: string;
  kind: NukemAIToolKind;
  inputSchema: NukemAIToolInputSchema;
  outputSchema?: Record<string, unknown>;
  maxResultBytes?: number;
  shouldDefer?: boolean;
  alwaysLoad?: boolean;
  searchHint?: string;
  isReadOnly(input: Input): boolean;
  isConcurrencySafe(input: Input): boolean;
  isDestructive?(input: Input): boolean;
  requiresUserInteraction?(input: Input): boolean;
  isOpenWorld?(input: Input): boolean;
  validateInput?(input: Input, context: NukemAIToolRuntimeContext): Promise<NukemAIToolValidationResult>;
  checkAvailability?(context: NukemAIToolAvailabilityContext): NukemAIToolAvailability | Promise<NukemAIToolAvailability>;
  checkPermissions?(input: Input, context: NukemAIToolRuntimeContext): Promise<PermissionResult>;
  execute(input: Input, context: NukemAIToolRuntimeContext): Promise<NukemAIToolExecutionOutput<Output>>;
};

export type NukemAIToolCall = CanonicalToolCall;
