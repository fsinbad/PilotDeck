export type NukemAIPermissionHookDecision =
  | {
      behavior: "allow";
      updatedInput?: Record<string, unknown>;
      updatedPermissions?: unknown[];
    }
  | {
      behavior: "deny";
      message?: string;
      interrupt?: boolean;
    };

export type NukemAIHookSpecificOutput = {
  hookEventName: string;
  additionalContext?: string;
  initialUserMessage?: string;
  watchPaths?: string[];
  permissionDecision?: "allow" | "deny" | "ask" | "passthrough";
  permissionDecisionReason?: string;
  updatedInput?: Record<string, unknown>;
  updatedMCPToolOutput?: unknown;
  decision?: NukemAIPermissionHookDecision;
  retry?: boolean;
  worktreePath?: string;
};

export type NukemAIHookSyncOutput = {
  type: "sync";
  continue?: boolean;
  suppressOutput?: boolean;
  stopReason?: string;
  decision?: "approve" | "block";
  reason?: string;
  systemMessage?: string;
  specific?: NukemAIHookSpecificOutput;
  raw?: unknown;
};

export type NukemAIHookAsyncOutput = {
  type: "async";
  raw?: unknown;
};

export type NukemAIHookOutput = NukemAIHookSyncOutput | NukemAIHookAsyncOutput;
