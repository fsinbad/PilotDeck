import type {
  NukemAIToolAvailability,
  NukemAIToolAvailabilityContext,
  NukemAIToolDefinition,
} from "../protocol/types.js";
import { ToolRegistry } from "./ToolRegistry.js";

export type NukemAIUnavailableToolDiagnostic = {
  toolName: string;
  code: Exclude<NukemAIToolAvailability, { ok: true }>["code"];
  reason: string;
};

export type FilterAvailableToolsResult = {
  registry: ToolRegistry;
  unavailable: NukemAIUnavailableToolDiagnostic[];
};

export async function filterAvailableTools(
  registry: ToolRegistry,
  context: NukemAIToolAvailabilityContext,
): Promise<FilterAvailableToolsResult> {
  const filtered = new ToolRegistry();
  const unavailable: NukemAIUnavailableToolDiagnostic[] = [];
  const checkCache = new Map<
    NonNullable<NukemAIToolDefinition["checkAvailability"]>,
    Promise<NukemAIToolAvailability>
  >();

  for (const tool of registry.list()) {
    const availability = await resolveToolAvailability(tool, context, checkCache);
    if (availability.ok) {
      filtered.register(tool);
      continue;
    }

    unavailable.push({
      toolName: tool.name,
      code: availability.code,
      reason: availability.reason,
    });
  }

  return { registry: filtered, unavailable };
}

async function resolveToolAvailability(
  tool: NukemAIToolDefinition,
  context: NukemAIToolAvailabilityContext,
  cache: Map<NonNullable<NukemAIToolDefinition["checkAvailability"]>, Promise<NukemAIToolAvailability>>,
): Promise<NukemAIToolAvailability> {
  const check = tool.checkAvailability;
  if (!check) {
    return { ok: true };
  }

  let promise = cache.get(check);
  if (!promise) {
    promise = Promise.resolve()
      .then(() => check(context))
      .catch((error): NukemAIToolAvailability => ({
        ok: false,
        code: "failed_check",
        reason: error instanceof Error ? error.message : String(error),
      }));
    cache.set(check, promise);
  }

  return promise;
}
