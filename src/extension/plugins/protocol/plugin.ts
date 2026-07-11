import type { NukemAIHooksSettings } from "../../hooks/protocol/settings.js";
import type { PromptContribution } from "../../contributions/PromptContribution.js";
import type { RouterContribution } from "../../contributions/RouterContribution.js";
import type { LoadedPluginCommand } from "../loading/PluginCommandLoader.js";
import type { NukemAIPluginManifest } from "./manifest.js";

export type NukemAIPluginSourceKind = "builtin" | "global" | "project";

export type NukemAILoadedPlugin = {
  name: string;
  path: string;
  source: NukemAIPluginSourceKind;
  manifest: NukemAIPluginManifest;
  hooksConfig?: NukemAIHooksSettings;
  commands?: LoadedPluginCommand[];
  skills?: LoadedPluginCommand[];
  outputStyles?: LoadedPluginCommand[];
  mcpServers?: Record<string, unknown>;
  lspServers?: Record<string, unknown>;
  /**
   * Programmatic contributions are currently only available to builtin or
   * test-injected plugins. Disk-loaded JSON plugins cannot provide functions.
   */
  promptContributions?: PromptContribution[];
  routerContributions?: RouterContribution[];
};
