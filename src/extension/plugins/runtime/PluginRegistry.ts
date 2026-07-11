import type { NukemAILoadedPlugin } from "../protocol/plugin.js";

export class PluginRegistry {
  private readonly plugins = new Map<string, NukemAILoadedPlugin>();

  replaceAll(plugins: NukemAILoadedPlugin[]): void {
    this.plugins.clear();
    for (const plugin of plugins) {
      this.plugins.set(`${plugin.name}@${plugin.source}`, plugin);
    }
  }

  list(): NukemAILoadedPlugin[] {
    return [...this.plugins.values()];
  }
}
