import { z } from "zod";

import type { ExtractOptionsResponse, PromptOptions } from "./types";

const promptOptionsSchema = z.object({
  duration_seconds: z.number().int().positive().nullable(),
  language: z.string().nullable(),
  platform: z.enum(["youtube", "instagram", "tiktok", "facebook", "generic"]).nullable(),
  size: z.enum(["landscape", "vertical", "square"]).nullable(),
  category: z.enum(["kids", "education", "marketing", "storytelling", "generic"]).nullable(),
});

const extractSchema = z.object({
  run_id: z.string().uuid(),
  options: promptOptionsSchema,
  missing_fields: z.array(
    z.enum(["duration_seconds", "language", "platform", "size", "category"]),
  ),
});

const enhanceSchema = z.object({
  run_id: z.string().uuid(),
  enhanced_prompt: z.string(),
});

const scriptSchema = z.object({
  run_id: z.string().uuid(),
  script: z.string(),
});

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api/v1";
const FETCH_TIMEOUT_MS = 30_000; // 30s so backend Groq timeout (15s) + fallback can complete
const SESSION_STORAGE_KEY = "prompt_intelligence_session_id";

function randomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older/insecure contexts (e.g. some mobile browsers)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreateSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      id = randomUUID();
      localStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return randomUUID();
  }
}

function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const sessionId = getOrCreateSessionId();
  if (sessionId) headers["X-Session-Id"] = sessionId;
  return headers;
}

async function postJson<T>(path: string, payload: unknown, schema: z.ZodSchema<T>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let body: { details?: string; error?: string } = {};
    try {
      body = await response.json();
    } catch {
      if (!response.ok) {
        throw new Error(response.status === 502 ? "Backend or Groq error. Try again or check backend logs." : "Request failed");
      }
    }
    if (!response.ok) {
      throw new Error(body.details ?? body.error ?? "Request failed");
    }
    return schema.parse(body);
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new Error(
          "Request timed out. Check that the backend is running and reachable. If using Groq, the API may be slow.",
        );
      }
      if (err.message.includes("fetch")) {
        throw new Error(
          "Network error: cannot reach the backend. Is it running at " + API_BASE + "?",
        );
      }
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function extractOptions(prompt: string): Promise<ExtractOptionsResponse> {
  return postJson("/prompts/extract-options", { prompt }, extractSchema);
}

export async function enhancePrompt(
  runId: string,
  prompt: string,
  options: PromptOptions,
): Promise<string> {
  const response = await postJson(
    "/prompts/enhance",
    { run_id: runId, prompt, options },
    enhanceSchema,
  );
  return response.enhanced_prompt;
}

export async function generateVideoScript(
  runId: string,
  prompt: string,
  options: PromptOptions,
): Promise<string> {
  const payload = {
    run_id: runId,
    prompt,
    options: {
      duration_seconds: options.duration_seconds,
      language: options.language,
      platform: options.platform,
      size: options.size,
      category: options.category,
    },
  };
  const response = await postJson("/prompts/generate-script", payload, scriptSchema);
  return response.script;
}
