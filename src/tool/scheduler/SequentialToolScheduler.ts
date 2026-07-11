import type { NukemAIToolResult } from "../protocol/result.js";
import type { NukemAIToolCall, NukemAIToolRuntimeContext } from "../protocol/types.js";
import type { ToolRuntime } from "../execution/ToolRuntime.js";
import type { NukemAIToolScheduler } from "./ToolScheduler.js";

export class SequentialToolScheduler implements NukemAIToolScheduler {
  constructor(private readonly runtime: ToolRuntime) {}

  async executeAll(
    calls: NukemAIToolCall[],
    context: NukemAIToolRuntimeContext,
  ): Promise<NukemAIToolResult[]> {
    const results: NukemAIToolResult[] = [];
    for (const call of calls) {
      results.push(await this.runtime.execute(call, context));
    }
    return results;
  }
}
