export type NukemAIToolInputSchema = {
  type: "object";
  properties?: Record<string, NukemAIJsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
};

export type NukemAIJsonSchema = {
  type?: string | string[];
  properties?: Record<string, NukemAIJsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: NukemAIJsonSchema;
  enum?: unknown[];
  [key: string]: unknown;
};

export type NukemAIToolValidationIssue = {
  path: string;
  code: "required" | "unknown_property" | "invalid_type" | "invalid_enum" | "invalid_schema";
  message: string;
};

export type NukemAIToolValidationResult =
  | { ok: true; input: unknown }
  | { ok: false; issues: NukemAIToolValidationIssue[] };
