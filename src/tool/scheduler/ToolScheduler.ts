import type { NukemAIToolResult } from "../protocol/result.js";
import type { NukemAIToolCall, NukemAIToolRuntimeContext } from "../protocol/types.js";

export type NukemAIToolScheduler = {
  executeAll(calls: NukemAIToolCall[], context: NukemAIToolRuntimeContext): Promise<NukemAIToolResult[]>;
};
