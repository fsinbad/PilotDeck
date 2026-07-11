import type { NukemAIHooksSettings } from "../../hooks/protocol/settings.js";

export type NukemAIPluginManifest = {
  name: string;
  version?: string;
  description?: string;
  commands?: string | string[];
  agents?: string | string[];
  skills?: string | string[];
  hooks?: string | NukemAIHooksSettings;
  mcpServers?: Record<string, unknown>;
  lspServers?: Record<string, unknown>;
  outputStyles?: string | string[];
  marketplace?: NukemAIMarketplaceReference;
  mcpb?: string;
  settings?: Record<string, unknown>;
};

export type NukemAIMarketplaceReference = {
  name: string;
  plugin: string;
  version?: string;
  source?: "marketplace" | "git" | "zip" | "mcpb";
  url?: string;
};
