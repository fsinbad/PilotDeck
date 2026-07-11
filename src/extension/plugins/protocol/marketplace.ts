import type { NukemAIMarketplaceReference } from "./manifest.js";

export type NukemAIPluginMarketplaceStatus = "resolved" | "deferred";

export type NukemAIMarketplaceResolution = {
  status: NukemAIPluginMarketplaceStatus;
  reference: NukemAIMarketplaceReference;
  reason?: string;
};

export function resolveMarketplaceReference(reference: NukemAIMarketplaceReference): NukemAIMarketplaceResolution {
  if (reference.source === "git" || reference.source === "zip" || reference.source === "mcpb") {
    return {
      status: "deferred",
      reference,
      reason: `${reference.source} installation is not implemented in the local runtime.`,
    };
  }
  return { status: "resolved", reference };
}
