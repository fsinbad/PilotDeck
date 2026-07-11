import type { CanonicalMessage } from "../../model/index.js";
import type { NukemAIHookEvent } from "../../extension/hooks/protocol/events.js";
import type { NukemAIHookBaseInput } from "../../extension/hooks/protocol/input.js";
import type { NukemAIHookEffect, NukemAILifecycleError } from "./effects.js";

export type LifecycleDispatchInput = {
  event: NukemAIHookEvent;
  baseInput: NukemAIHookBaseInput;
  payload?: Record<string, unknown>;
  matchQuery?: string;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
};

export type LifecycleDispatchResult = {
  effects: NukemAIHookEffect[];
  messages: CanonicalMessage[];
  events: unknown[];
  blockingErrors: NukemAILifecycleError[];
  nonBlockingErrors: NukemAILifecycleError[];
};

export function emptyLifecycleDispatchResult(): LifecycleDispatchResult {
  return {
    effects: [],
    messages: [],
    events: [],
    blockingErrors: [],
    nonBlockingErrors: [],
  };
}
