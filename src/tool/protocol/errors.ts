export type NukemAIToolErrorCode =
  | "tool_not_found"
  | "invalid_tool_input"
  | "permission_denied"
  | "permission_cancelled"
  | "permission_required"
  | "tool_execution_failed"
  | "tool_aborted"
  | "tool_timeout"
  | "result_too_large"
  | "path_not_allowed"
  | "file_not_found"
  | "file_conflict"
  | "unsupported_tool"
  | "setup_required"
  | "plan_mode_violation"
  | "ask_mode_violation";

export type NukemAIToolError = {
  code: NukemAIToolErrorCode;
  message: string;
  cause?: unknown;
  details?: Record<string, unknown>;
};

export class NukemAIToolRuntimeError extends Error {
  readonly code: NukemAIToolErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: NukemAIToolErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "NukemAIToolRuntimeError";
    this.code = code;
    this.details = details;
  }
}

export function toolError(
  code: NukemAIToolErrorCode,
  message: string,
  details?: Record<string, unknown>,
): NukemAIToolError {
  return { code, message, details };
}

export function normalizeToolError(error: unknown): NukemAIToolError {
  if (error instanceof NukemAIToolRuntimeError) {
    return toolError(error.code, error.message, error.details);
  }

  if (error instanceof Error) {
    return {
      code: "tool_execution_failed",
      message: error.message,
      cause: error,
    };
  }

  return {
    code: "tool_execution_failed",
    message: "Tool execution failed with a non-Error value.",
    cause: error,
  };
}
