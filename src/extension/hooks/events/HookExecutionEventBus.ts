import type { NukemAIHookEvent } from "../protocol/events.js";

export type NukemAIHookExecutionEvent =
  | {
      type: "started";
      hookName: string;
      hookEvent: NukemAIHookEvent;
    }
  | {
      type: "response";
      hookName: string;
      hookEvent: NukemAIHookEvent;
      stdout: string;
      stderr: string;
      exitCode?: number;
      outcome: "success" | "blocking" | "non_blocking_error" | "cancelled" | "timeout";
    };

export type NukemAIHookExecutionEventHandler = (event: NukemAIHookExecutionEvent) => void;

export class HookExecutionEventBus {
  private handlers = new Set<NukemAIHookExecutionEventHandler>();

  subscribe(handler: NukemAIHookExecutionEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  emit(event: NukemAIHookExecutionEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }
}
