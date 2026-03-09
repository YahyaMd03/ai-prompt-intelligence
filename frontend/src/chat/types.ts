import type { OptionField, PromptOptions } from "../types";

export type ChatRole = "user" | "assistant";

export type ChatMessage =
  | {
      id: string;
      role: "user";
      type: "text";
      text: string;
      createdAt: number;
    }
  | {
      id: string;
      role: "assistant";
      type: "text";
      text: string;
      quickReplyField?: OptionField;
      quickReplies?: Array<{ id: string; label: string; value: string }>;
      createdAt: number;
    }
  | {
      id: string;
      role: "assistant";
      type: "options";
      createdAt: number;
      runId: string;
      missingFields: OptionField[];
    }
  | {
      id: string;
      role: "assistant";
      type: "enhancedPrompt";
      createdAt: number;
      runId: string;
      originalPrompt: string;
      enhancedPrompt: string;
    }
  | {
      id: string;
      role: "assistant";
      type: "scriptOutput";
      createdAt: number;
      runId: string;
      promptUsed: string;
      script: string;
    };

export type PipelinePhase =
  | "idle"
  | "extracting"
  | "awaiting_missing"
  | "enhancing"
  | "awaiting_generate_choice"
  | "generating"
  | "done";

export const OPTION_FIELDS: OptionField[] = [
  "duration_seconds",
  "language",
  "platform",
  "size",
  "category",
];

export function computeMissingFields(options: PromptOptions): OptionField[] {
  const missing: OptionField[] = [];
  for (const field of OPTION_FIELDS) {
    if (options[field] == null) missing.push(field);
  }
  return missing;
}

