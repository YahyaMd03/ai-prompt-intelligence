import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { enhancePrompt, extractOptions, generateVideoScript } from "./api";
import { parseScriptToScenes } from "./scriptParser";
import type { PromptOptions } from "./types";

const MAX_CHARS = 12000;
const LONG_PROMPT_THRESHOLD = 4000;
const TRUNCATE_FOR_GENERATION = 12000;

const emptyOptions: PromptOptions = {
  duration_seconds: null,
  language: null,
  platform: null,
  size: null,
  category: null,
};

const PLACEHOLDER_PROMPT =
  "A fun 30-second kids video teaching hand washing for YouTube Shorts, vertical format, English.";

const SUGGESTED_PROMPTS = [
  "Create a 30 second kids educational video about cleanliness for YouTube in English, vertical format.",
  "Make a 1-minute product demo for Instagram Reels, square format, marketing tone.",
  "Write a 45-second storytelling video about a day in the life of a chef, TikTok, vertical.",
];

const EXTRACT_LOADING_MESSAGES = [
  "Analyzing your idea…",
  "Identifying duration, platform, and style…",
  "Detecting language and format…",
  "Almost there…",
];

const ENHANCE_LOADING_MESSAGES = [
  "Polishing your prompt…",
  "Adding structure and clarity…",
  "Optimizing for video script generation…",
  "Nearly done…",
];

const SCRIPT_LOADING_MESSAGES = [
  "Writing your cinematic script…",
  "Breaking it into scenes and shots…",
  "Adding visuals and narration…",
  "Crafting mood and direction…",
  "Putting the final touches…",
];

const LOADING_MESSAGE_INTERVAL_MS = 2800;

type ActionState = "idle" | "loading" | "error" | "success";

export function App() {
  const [runId, setRunId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<PromptOptions>(emptyOptions);
  const [script, setScript] = useState("");
  const [, setHasEnhancedOnce] = useState(false);
  const [enhanceSuccessMessage, setEnhanceSuccessMessage] = useState(false);
  const [status, setStatus] = useState<Record<string, ActionState>>({
    extract: "idle",
    enhance: "idle",
    script: "idle",
  });
  const [error, setError] = useState<string | null>(null);
  const [aiStep, setAiStep] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadingPhase = status.extract === "loading" ? "extract" : status.enhance === "loading" ? "enhance" : status.script === "loading" ? "script" : null;
  const loadingMessages =
    loadingPhase === "extract"
      ? EXTRACT_LOADING_MESSAGES
      : loadingPhase === "enhance"
        ? ENHANCE_LOADING_MESSAGES
        : loadingPhase === "script"
          ? SCRIPT_LOADING_MESSAGES
          : [];
  const currentLoadingMessage =
    loadingMessages.length > 0
      ? loadingMessages[loadingMessageIndex % loadingMessages.length]
      : "";

  const withinLimit = prompt.length <= MAX_CHARS;
  const tokenWarning = useMemo(() => {
    if (prompt.length < LONG_PROMPT_THRESHOLD) return null;
    return "Long prompt — may slow generation";
  }, [prompt.length]);
  const anyActionLoading =
    status.extract === "loading" ||
    status.enhance === "loading" ||
    status.script === "loading";
  const canEnhance = useMemo(
    () => prompt.trim().length > 0 && prompt.length <= MAX_CHARS && runId,
    [prompt, runId],
  );
  const canGenerate = useMemo(
    () =>
      prompt.trim().length > 0 &&
      prompt.length <= MAX_CHARS &&
      runId,
    [prompt, runId],
  );
  const promptForGeneration = useMemo(() => {
    if (prompt.length <= TRUNCATE_FOR_GENERATION) return prompt;
    return prompt.slice(0, TRUNCATE_FOR_GENERATION);
  }, [prompt]);
  const wasTruncatedForGeneration =
    prompt.length > TRUNCATE_FOR_GENERATION && script !== "";

  const parsedScenes = useMemo(() => parseScriptToScenes(script), [script]);

  const handleExtractOptions = useCallback(async () => {
    if (!prompt.trim() || !withinLimit || status.extract === "loading") return;
    setStatus((prev) => ({ ...prev, extract: "loading" }));
    setError(null);
    try {
      const result = await extractOptions(prompt);
      setRunId(result.run_id);
      setOptions(result.options);
      setStatus((prev) => ({ ...prev, extract: "success" }));
      setAiStep("Options extracted. You can edit them or enhance the prompt.");
      setTimeout(() => setAiStep(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown extract failure");
      setStatus((prev) => ({ ...prev, extract: "error" }));
      setAiStep(null);
    }
  }, [prompt, withinLimit, status.extract]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleExtractOptions();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleExtractOptions]);

  useEffect(() => {
    if (!anyActionLoading) return;
    setLoadingMessageIndex(0);
    const id = setInterval(() => {
      setLoadingMessageIndex((i) => i + 1);
    }, LOADING_MESSAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [anyActionLoading, status.extract, status.enhance, status.script]);

  function handleSuggestedPromptClick(suggestion: string) {
    const text = suggestion.slice(0, MAX_CHARS);
    setPrompt(text);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(text.length, text.length);
    });
  }

  async function handleEnhancePrompt() {
    if (!runId || anyActionLoading) return;
    setStatus((prev) => ({ ...prev, enhance: "loading" }));
    setError(null);
    setEnhanceSuccessMessage(false);
    try {
      const enhancedPrompt = await enhancePrompt(runId, prompt, options);
      setPrompt(enhancedPrompt.slice(0, MAX_CHARS));
      setStatus((prev) => ({ ...prev, enhance: "success" }));
      setHasEnhancedOnce(true);
      setEnhanceSuccessMessage(true);
      setAiStep(null);
      setTimeout(() => setEnhanceSuccessMessage(false), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown enhancement failure");
      setStatus((prev) => ({ ...prev, enhance: "error" }));
      setAiStep(null);
    }
  }

  async function handleGenerateScript() {
    if (!runId || anyActionLoading) return;
    setStatus((prev) => ({ ...prev, script: "loading" }));
    setError(null);
    try {
      const generatedScript = await generateVideoScript(
        runId,
        promptForGeneration,
        options,
      );
      setScript(generatedScript);
      setStatus((prev) => ({ ...prev, script: "success" }));
      setAiStep("Script ready. Check the output below.");
      setTimeout(() => setAiStep(null), 4000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unknown script generation failure",
      );
      setStatus((prev) => ({ ...prev, script: "error" }));
      setAiStep(null);
    }
  }

  return (
    <div className="app-shell">
      <header className="header">
        <h1 className="logo">Prompt to Script</h1>
        <p className="header-subtext">
          We&apos;ll extract details, enhance it, and generate a cinematic
          script.
        </p>
      </header>

      <div className="main-grid">
        <div
          className={
            runId || status.extract === "loading"
              ? "prompt-and-options-row"
              : "prompt-only"
          }
        >
          {/* 1. Prompt box — left / full width until Extract is clicked */}
          <section className="prompt-section" aria-labelledby="prompt-box-heading">
            <h2 id="prompt-box-heading" className="section-title">Prompt Box</h2>
            <div className="prompt-wrap">
            <div className="prompt-inner">
              <div className="prompt-textarea-wrap">
                <textarea
                  ref={textareaRef}
                  aria-label="Prompt Box"
                  value={prompt}
                  onChange={(e) =>
                    setPrompt(e.target.value.slice(0, MAX_CHARS))
                  }
                  placeholder={PLACEHOLDER_PROMPT}
                  maxLength={MAX_CHARS}
                  rows={6}
                />
                <span className="char-count-corner" aria-live="polite">
                  {prompt.length.toLocaleString()} /{" "}
                  {MAX_CHARS.toLocaleString()}
                </span>
              </div>
              {tokenWarning && (
                <div className="prompt-feedback" role="status">
                  {tokenWarning}
                </div>
              )}
              <div className="prompt-actions-row">
                <button
                  type="button"
                  className={`btn-extract ${status.extract === "loading" ? "loading" : ""}`}
                  onClick={() => handleExtractOptions()}
                  disabled={
                    anyActionLoading ||
                    !prompt.trim() ||
                    !withinLimit
                  }
                  aria-busy={status.extract === "loading"}
                  aria-live="polite"
                >
                  {status.extract === "loading" ? (
                    <>
                      <span className="btn-extract-spinner" aria-hidden />
                      <span className="label">Extract Options</span>
                    </>
                  ) : (
                    <span className="label">Extract Options</span>
                  )}
                </button>
                {runId && (
                  <button
                    type="button"
                    className={`cta-primary cta-generate ${
                      status.script === "loading" ? "loading" : ""
                    }`}
                    onClick={handleGenerateScript}
                    disabled={!canGenerate || anyActionLoading}
                    aria-busy={status.script === "loading"}
                  >
                    {status.script === "loading" ? (
                      <>
                        <span className="cta-primary-spinner" aria-hidden />
                        <span className="label">Writing cinematic script…</span>
                      </>
                    ) : (
                      <>
                        <span className="sparkle" aria-hidden>✦</span>
                        <span className="label">Generate Video Script</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              {!prompt.trim() && (
                <div className="suggested-prompts">
                  <span className="suggested-prompts-label">
                    Try a suggested prompt:
                  </span>
                  <div className="suggested-prompts-list">
                    {SUGGESTED_PROMPTS.map((suggestion) => (
                      <button
                        key={suggestion.slice(0, 40)}
                        type="button"
                        className="suggested-prompt-chip"
                        title="Click to use & edit"
                        onClick={() =>
                          handleSuggestedPromptClick(suggestion)
                        }
                      >
                        {suggestion.slice(0, 60)}
                        {suggestion.length > 60 ? "…" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          </section>

          {/* 2. Extracted options — right column, only after user clicks Extract */}
          {(runId || status.extract === "loading") && (
            <aside className="options-card-section" aria-label="Extracted options">
              {status.extract === "loading" && (
                <div className="options-loading" aria-live="polite" aria-busy="true">
                  <span className="cta-primary-spinner options-loading-spinner" aria-hidden />
                  <span className="options-loading-message">{currentLoadingMessage}</span>
                </div>
              )}
              {runId && status.extract !== "loading" && (
                <div className="panel options-card">
                <p className="options-card-hint">
                  You can edit these before enhancement
                </p>
                <div className="options-card-grid">
                  <label>
                    Duration (seconds)
                    <input
                      type="number"
                      min={1}
                      value={options.duration_seconds ?? ""}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          duration_seconds: e.target.value
                            ? Number(e.target.value)
                            : null,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Language
                    <input
                      type="text"
                      value={options.language ?? ""}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          language: e.target.value || null,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Platform
                    <select
                      value={options.platform ?? ""}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          platform: (e.target.value ||
                            null) as PromptOptions["platform"],
                        }))
                      }
                    >
                      <option value="">—</option>
                      <option value="youtube">YouTube</option>
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="facebook">Facebook</option>
                      <option value="generic">Generic</option>
                    </select>
                  </label>
                  <label>
                    Size
                    <select
                      value={options.size ?? ""}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          size: (e.target.value ||
                            null) as PromptOptions["size"],
                        }))
                      }
                    >
                      <option value="">—</option>
                      <option value="landscape">Landscape</option>
                      <option value="vertical">Vertical</option>
                      <option value="square">Square</option>
                    </select>
                  </label>
                  <label>
                    Category
                    <select
                      value={options.category ?? ""}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          category: (e.target.value ||
                            null) as PromptOptions["category"],
                        }))
                      }
                    >
                      <option value="">—</option>
                      <option value="kids">Kids</option>
                      <option value="education">Education</option>
                      <option value="marketing">Marketing</option>
                      <option value="storytelling">Storytelling</option>
                      <option value="generic">Generic</option>
                    </select>
                  </label>
                </div>
                <div className="options-card-actions">
                  <button
                    type="button"
                    className={`btn-action btn-enhance ${
                      status.enhance === "loading" ? "loading" : ""
                    }`}
                    onClick={handleEnhancePrompt}
                    disabled={!canEnhance || anyActionLoading}
                  >
                    <span className="label">Enhance Prompt</span>
                  </button>
                </div>
              </div>
              )}
            </aside>
          )}
        </div>

        {enhanceSuccessMessage && (
          <div className="enhance-success-message" role="status">
            Prompt enhanced — you can still modify it
          </div>
        )}

        {(aiStep || status.enhance === "loading") && (
          <div className="ai-step-banner" role="status" aria-live="polite">
            <span className="ai-step-dot" aria-hidden />
            <span className="ai-step-message">
              {status.enhance === "loading" ? currentLoadingMessage : aiStep}
            </span>
          </div>
        )}

        {/* Script output — scene cards or empty state */}
        <section className="script-output-section" aria-label="Output Script">
          <h2 className="script-output-label">
            {script
              ? "Your script is ready — scenes below"
              : "Output Script"}
          </h2>
          {runId && prompt.length > TRUNCATE_FOR_GENERATION && (
            <p className="token-safety-note" aria-live="polite">
              Long prompt will be shortened before generation.
            </p>
          )}
          {status.script === "loading" && !script && (
            <div className="script-output-placeholder" aria-live="polite">
              {currentLoadingMessage}
            </div>
          )}
          {script && parsedScenes.length > 0 && (
            <div className="script-scenes">
              {parsedScenes.map((scene, i) => (
                <article
                  key={i}
                  className="scene-card"
                  aria-label={scene.title}
                >
                  <h3 className="scene-card-title">{scene.title}</h3>
                  <div className="scene-card-row">
                    <span className="scene-card-label">Visuals</span>
                    <p className="scene-card-value">{scene.visuals}</p>
                  </div>
                  <div className="scene-card-row">
                    <span className="scene-card-label">Narration</span>
                    <p className="scene-card-value">{scene.narration}</p>
                  </div>
                  <div className="scene-card-row">
                    <span className="scene-card-label">Mood</span>
                    <p className="scene-card-value">{scene.mood}</p>
                  </div>
                  <div className="scene-card-row">
                    <span className="scene-card-label">
                      Cinematic Direction
                    </span>
                    <p className="scene-card-value">
                      {scene.cinematicDirection}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
          {!script && status.script !== "loading" && (
            <p className="script-output-empty-text">
              No script generated yet. Extract options, enhance your prompt,
              then generate the video script.
            </p>
          )}
          {wasTruncatedForGeneration && (
            <p className="script-truncate-note">
              Prompt was shortened before generation due to length.
            </p>
          )}
        </section>
      </div>

      {error && (
        <p className="error">
          Error: {error}
          <span className="error-hint"> Try again or rephrase your prompt.</span>
        </p>
      )}
    </div>
  );
}
