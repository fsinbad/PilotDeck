import type { NukemAILoadedPlugin } from "../protocol/plugin.js";

export function discoverBuiltinPlugins(plugins: NukemAILoadedPlugin[] = []): NukemAILoadedPlugin[] {
  return plugins.filter((plugin) => plugin.source === "builtin");
}
