export type NukemAIExtensionError = {
  code: "extension_load_failed" | "extension_invalid";
  message: string;
};
