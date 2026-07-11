import type { PermissionDecision, PermissionDecisionReason, PermissionMode } from "../../permission/index.js";
import type { NukemAIToolErrorCode } from "../protocol/errors.js";

export type NukemAIPermissionAuditRecord = {
  type: "permission";
  sessionId: string;
  turnId: string;
  toolCallId: string;
  toolName: string;
  mode: PermissionMode;
  decision: PermissionDecision["type"];
  reason: PermissionDecisionReason;
  createdAt: string;
};

export type NukemAIToolAuditRecord = {
  type: "tool";
  sessionId: string;
  turnId: string;
  toolCallId: string;
  toolName: string;
  status: "success" | "error";
  errorCode?: NukemAIToolErrorCode;
  startedAt: string;
  completedAt: string;
  durationMs: number;
};

export type NukemAIToolAuditRecorder = {
  recordPermission(record: NukemAIPermissionAuditRecord): void | Promise<void>;
  recordTool(record: NukemAIToolAuditRecord): void | Promise<void>;
};
