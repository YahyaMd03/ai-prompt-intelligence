import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { enhancePrompt, extractOptions, generateVideoScript } from "../api";
import type { OptionField, PromptOptions } from "../types";
import { applyFieldAnswer, promptForField, quickRepliesForField } from "./optionParsing";
import { computeMissingFields } from "./types";
import type { ChatMessage, PipelinePhase } from "./types";

const MAX_CHARS = 12000;
const TRUNCATE_FOR_GENERATION = 12000;

const emptyOptions: PromptOptions = {
  duration_seconds: null,
  language: null,
  platform: null,
  size: null,
  category: null,
};

const SUGGESTED_PROMPTS = [
  "Create a 30 second kids educational video about cleanliness for YouTube in English, vertical format.",
  "Make a 1-minute product demo for Instagram Reels, square format, marketing tone.",
  "Write a 45-second storytelling video about a day in the life of a chef, TikTok, vertical.",
];

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

function now(): number {
  return Date.now();
}

function pickNextMissing(missingOrder: OptionField[], options: PromptOptions): OptionField | null {
  for (const f of missingOrder) {
    if (options[f] == null) return f;
  }
  return null;
}

export type UseChatPipeline = {
  phase: PipelinePhase;
  isBusy: boolean;
  messages: ChatMessage[];
  composerText: string;
  setComposerText: (v: string) => void;
  suggestedPrompts: string[];
  applySuggestedPrompt: (p: string) => void;
  send: () => void;
  quickReply: (field: OptionField, value: string) => void;
  options: PromptOptions;
  updateOptions: (next: PromptOptions) => void;
  chooseGenerate: (mode: "enhanced" | "original", editedPrompt?: string) => void;
  typingText: string | null;
};

type MessageDraft =
  | Omit<Extract<ChatMessage, { role: "user"; type: "text" }>, "id" | "createdAt">
  | Omit<
      Extract<ChatMessage, { role: "assistant"; type: "text" }>,
      "id" | "createdAt"
    >
  | Omit<
      Extract<ChatMessage, { role: "assistant"; type: "options" }>,
      "id" | "createdAt"
    >
  | Omit<
      Extract<ChatMessage, { role: "assistant"; type: "enhancedPrompt" }>,
      "id" | "createdAt"
    >
  | Omit<
      Extract<ChatMessage, { role: "assistant"; type: "scriptOutput" }>,
      "id" | "createdAt"
    >;

export function useChatPipeline(): UseChatPipeline {
  const [phase, setPhase] = useState<PipelinePhase>("idle");
  const [typingText, setTypingText] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: randomId(),
      role: "assistant",
      type: "text",
      text: "Tell me what video you want to make, and I’ll extract the details, enhance the prompt, and generate a cinematic script.",
      createdAt: now(),
    },
  ]);

  const [composerText, setComposerText] = useState("");

  const [runId, setRunId] = useState<string | null>(null);
  const [originalPrompt, setOriginalPrompt] = useState<string>("");
  const [enhancedPromptText, setEnhancedPromptText] = useState<string>("");
  const [options, setOptions] = useState<PromptOptions>(emptyOptions);
  const [missingOrder, setMissingOrder] = useState<OptionField[]>([
    "duration_seconds",
    "language",
    "platform",
    "size",
    "category",
  ]);
  const [awaitingField, setAwaitingField] = useState<OptionField | null>(null);

  const isBusy = phase === "extracting" || phase === "enhancing" || phase === "generating";

  const addMessage = useCallback((m: MessageDraft) => {
    setMessages((prev) => [
      ...prev,
      {
        ...m,
        id: randomId(),
        createdAt: now(),
      },
    ]);
  }, []);

  const missingFields = useMemo(() => computeMissingFields(options), [options]);

  const runAskMissing = useCallback(
    (field: OptionField) => {
      setAwaitingField(field);
      const quickReplies = quickRepliesForField(field);
      addMessage({
        role: "assistant",
        type: "text",
        text: promptForField(field),
        quickReplyField: quickReplies.length ? field : undefined,
        quickReplies: quickReplies.length ? quickReplies : undefined,
      });
    },
    [addMessage],
  );

  const runEnhance = useCallback(
    async (rid: string, prompt: string, opts: PromptOptions) => {
      setPhase("enhancing");
      setTypingText("Polishing your prompt…");
      addMessage({ role: "assistant", type: "text", text: "Great — enhancing your prompt now." });
      try {
        const enhanced = await enhancePrompt(rid, prompt, opts);
        const clipped = enhanced.slice(0, MAX_CHARS);
        setEnhancedPromptText(clipped);
        addMessage({
          role: "assistant",
          type: "enhancedPrompt",
          runId: rid,
          originalPrompt: prompt,
          enhancedPrompt: clipped,
        });
        setPhase("awaiting_generate_choice");
      } catch (err) {
        addMessage({
          role: "assistant",
          type: "text",
          text:
            "I couldn’t enhance the prompt. " +
            (err instanceof Error ? err.message : "Please try again."),
        });
        setPhase("idle");
      } finally {
        setTypingText(null);
      }
    },
    [addMessage],
  );

  const runExtract = useCallback(
    async (prompt: string) => {
      setPhase("extracting");
      setTypingText("Analyzing your idea…");
      addMessage({ role: "user", type: "text", text: prompt });
      addMessage({ role: "assistant", type: "text", text: "Got it. Let me extract the key details." });

      try {
        const result = await extractOptions(prompt);
        setRunId(result.run_id);
        setOriginalPrompt(prompt);
        setOptions(result.options);

        const order: OptionField[] = [];
        for (const f of result.missing_fields) if (!order.includes(f)) order.push(f);
        for (const f of ["duration_seconds", "language", "platform", "size", "category"] as const)
          if (!order.includes(f)) order.push(f);
        setMissingOrder(order);

        addMessage({
          role: "assistant",
          type: "text",
          text: "I detected the following details from your prompt.",
        });
        addMessage({
          role: "assistant",
          type: "options",
          runId: result.run_id,
          missingFields: result.missing_fields,
        });

        const next = pickNextMissing(order, result.options);
        if (next) {
          setPhase("awaiting_missing");
          runAskMissing(next);
        } else {
          await runEnhance(result.run_id, prompt, result.options);
        }
      } catch (err) {
        addMessage({
          role: "assistant",
          type: "text",
          text:
            "I couldn’t extract options. " +
            (err instanceof Error ? err.message : "Please try again."),
        });
        setPhase("idle");
      } finally {
        setTypingText(null);
      }
    },
    [addMessage, runAskMissing, runEnhance],
  );

  const advanceAfterOptions = useCallback(async () => {
    if (!runId) return;
    const next = pickNextMissing(missingOrder, options);
    if (next) {
      setPhase("awaiting_missing");
      runAskMissing(next);
      return;
    }
    setAwaitingField(null);
    await runEnhance(runId, originalPrompt, options);
  }, [missingOrder, options, originalPrompt, runAskMissing, runEnhance, runId]);

  // If user edits the option card directly and completes missing fields, proceed.
  const lastMissingKey = useRef<string>("");
  useEffect(() => {
    if (phase !== "awaiting_missing") return;
    const key = JSON.stringify(missingFields);
    if (key === lastMissingKey.current) return;
    lastMissingKey.current = key;
    const next = pickNextMissing(missingOrder, options);
    if (!next) {
      addMessage({ role: "assistant", type: "text", text: "Perfect — I have everything I need." });
      void advanceAfterOptions();
      return;
    }
    if (awaitingField && awaitingField !== next) {
      addMessage({ role: "assistant", type: "text", text: "Thanks — one more detail." });
      runAskMissing(next);
    }
  }, [
    addMessage,
    advanceAfterOptions,
    awaitingField,
    missingFields,
    missingOrder,
    options,
    phase,
    runAskMissing,
  ]);

  const updateOptions = useCallback((next: PromptOptions) => {
    setOptions(next);
  }, []);

  const answerMissing = useCallback(
    async (field: OptionField, rawAnswer: string) => {
      if (phase !== "awaiting_missing") return;
      addMessage({ role: "user", type: "text", text: rawAnswer });
      const parsed = applyFieldAnswer(options, field, rawAnswer);
      if (!parsed.ok) {
        addMessage({ role: "assistant", type: "text", text: parsed.error });
        runAskMissing(field);
        return;
      }
      setOptions(parsed.nextOptions);
      addMessage({ role: "assistant", type: "text", text: "Got it." });
      const next = pickNextMissing(missingOrder, parsed.nextOptions);
      if (next) {
        setPhase("awaiting_missing");
        runAskMissing(next);
        return;
      }
      setAwaitingField(null);
      await runEnhance(runId!, originalPrompt, parsed.nextOptions);
    },
    [addMessage, missingOrder, options, originalPrompt, phase, runAskMissing, runEnhance, runId],
  );

  const send = useCallback(() => {
    const text = composerText.trim();
    if (!text) return;
    if (isBusy) return;

    if (phase === "idle") {
      setComposerText("");
      void runExtract(text.slice(0, MAX_CHARS));
      return;
    }

    if (phase === "awaiting_missing" && awaitingField) {
      setComposerText("");
      void answerMissing(awaitingField, text.slice(0, MAX_CHARS));
      return;
    }

    // In other phases, free-text input is ignored to keep the workflow deterministic.
  }, [answerMissing, awaitingField, composerText, isBusy, phase, runExtract]);

  const quickReply = useCallback(
    (field: OptionField, value: string) => {
      if (isBusy) return;
      if (phase !== "awaiting_missing") return;
      if (!awaitingField || awaitingField !== field) return;
      void answerMissing(field, value);
    },
    [answerMissing, awaitingField, isBusy, phase],
  );

  const chooseGenerate = useCallback(
    async (mode: "enhanced" | "original", editedPrompt?: string) => {
      if (!runId) return;
      if (isBusy) return;
      if (phase !== "awaiting_generate_choice") return;

      const base =
        typeof editedPrompt === "string" && editedPrompt.trim()
          ? editedPrompt.trim()
          : mode === "enhanced"
            ? enhancedPromptText || originalPrompt
            : originalPrompt;
      const promptUsed =
        base.length <= TRUNCATE_FOR_GENERATION ? base : base.slice(0, TRUNCATE_FOR_GENERATION);

      setPhase("generating");
      setTypingText("Writing your cinematic script…");
      addMessage({
        role: "assistant",
        type: "text",
        text: "Awesome. Writing your cinematic script now.",
      });

      try {
        const script = await generateVideoScript(runId, promptUsed, options);
        addMessage({
          role: "assistant",
          type: "scriptOutput",
          runId,
          promptUsed,
          script,
        });
        setPhase("done");
      } catch (err) {
        addMessage({
          role: "assistant",
          type: "text",
          text:
            "I couldn’t generate the script. " +
            (err instanceof Error ? err.message : "Please try again."),
        });
        setPhase("awaiting_generate_choice");
      } finally {
        setTypingText(null);
      }
    },
    [
      addMessage,
      enhancedPromptText,
      isBusy,
      options,
      originalPrompt,
      phase,
      runId,
    ],
  );

  const suggestedPrompts = useMemo(() => SUGGESTED_PROMPTS, []);

  const applySuggestedPrompt = useCallback((p: string) => {
    setComposerText(p.slice(0, MAX_CHARS));
  }, []);

  return {
    phase,
    isBusy,
    messages,
    composerText,
    setComposerText,
    suggestedPrompts,
    applySuggestedPrompt,
    send,
    quickReply,
    options,
    updateOptions,
    chooseGenerate,
    typingText,
  };
}

