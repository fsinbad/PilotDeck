export class NukemAILifecycleRuntimeError extends Error {
  readonly name = "NukemAILifecycleRuntimeError";

  constructor(
    readonly code: "hook_blocked" | "hook_failed",
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
