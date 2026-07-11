import type { NukemAIHooksSettings } from "../../hooks/protocol/settings.js";
import type { NukemAILoadedPlugin } from "../protocol/plugin.js";

export function loadPluginHooks(plugins: NukemAILoadedPlugin[]): NukemAIHooksSettings {
  const settings: NukemAIHooksSettings = {};
  for (const plugin of plugins) {
    for (const [event, matchers] of Object.entries(plugin.hooksConfig ?? {}) as Array<
      [keyof NukemAIHooksSettings, NonNullable<NukemAIHooksSettings[keyof NukemAIHooksSettings]>]
    >) {
      settings[event] = [
        ...(settings[event] ?? []),
        ...matchers.map((matcher) => ({
          ...matcher,
          pluginName: plugin.name,
          pluginId: `${plugin.name}@${plugin.source}`,
          pluginRoot: plugin.path,
        })),
      ];
    }
  }
  return settings;
}
