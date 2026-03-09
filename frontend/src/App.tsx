import { useEffect, useMemo, useRef } from "react";

import { computeMissingFields } from "./chat/types";
import { useChatPipeline } from "./chat/useChatPipeline";
import { AssistantMessage } from "./components/chat/AssistantMessage";
import { ChatContainer } from "./components/chat/ChatContainer";
import { OptionCard } from "./components/chat/OptionCard";
import { PromptInput } from "./components/chat/PromptInput";
import { ScriptOutputCard } from "./components/chat/ScriptOutputCard";
import { TypingIndicator } from "./components/chat/TypingIndicator";
import { UserMessage } from "./components/chat/UserMessage";

export function App() {
  const {
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
    isBusy,
    typingText,
    phase,
  } = useChatPipeline();

  const missingFields = useMemo(() => computeMissingFields(options), [options]);

  const threadRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = distanceFromBottom < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    if (!stickToBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, typingText]);

  const placeholder =
    phase === "awaiting_missing" ? "Answer the question…" : "Describe your video idea…";

  return (
    <ChatContainer
      title="Prompt Intelligence"
      subtitle="Chat your idea → extracted options → enhanced prompt → cinematic script"
    >
      <div className="chatLayout">
        <div className="chatThread" ref={threadRef} aria-label="Conversation">
          <div className="chatThreadInner">
            {messages.map((m) => {
              if (m.role === "user" && m.type === "text") {
                return (
                  <UserMessage key={m.id}>
                    <div className="chatText">{m.text}</div>
                  </UserMessage>
                );
              }

              if (m.role === "assistant" && m.type === "text") {
                return (
                  <AssistantMessage
                    key={m.id}
                    footer={
                      m.quickReplies && m.quickReplyField ? (
                        <div className="quickReplies">
                          {m.quickReplies.map((q) => (
                            <button
                              key={q.id}
                              type="button"
                              className="quickReplyBtn"
                              onClick={() => quickReply(m.quickReplyField!, q.value)}
                              disabled={isBusy}
                            >
                              {q.label}
                            </button>
                          ))}
                        </div>
                      ) : null
                    }
                  >
                    <div className="chatText">{m.text}</div>
                  </AssistantMessage>
                );
              }

              if (m.role === "assistant" && m.type === "options") {
                return (
                  <AssistantMessage key={m.id}>
                    <OptionCard
                      options={options}
                      missingFields={missingFields}
                      onChange={updateOptions}
                    />
                  </AssistantMessage>
                );
              }

              if (m.role === "assistant" && m.type === "enhancedPrompt") {
                return (
                  <AssistantMessage
                    key={m.id}
                    footer={
                      <div className="enhanceActions">
                        <button
                          type="button"
                          className="primaryActionBtn"
                          onClick={() => chooseGenerate("enhanced")}
                          disabled={isBusy}
                        >
                          Use enhanced & generate
                        </button>
                        <button
                          type="button"
                          className="secondaryActionBtn"
                          onClick={() => chooseGenerate("original")}
                          disabled={isBusy}
                        >
                          Generate with original
                        </button>
                      </div>
                    }
                  >
                    <div className="enhancedPromptCard" aria-label="Enhanced prompt">
                      <div className="enhancedPromptTitle">
                        Enhanced prompt (ready to generate)
                      </div>
                      <pre className="enhancedPromptBlock">{m.enhancedPrompt.trim()}</pre>
                      <div className="enhancedPromptHint">
                        Would you like to use this enhanced prompt before generating the script?
                      </div>
                    </div>
                  </AssistantMessage>
                );
              }

              if (m.role === "assistant" && m.type === "scriptOutput") {
                return (
                  <AssistantMessage key={m.id}>
                    <ScriptOutputCard script={m.script} />
                  </AssistantMessage>
                );
              }

              return null;
            })}

            {typingText ? <TypingIndicator text={typingText} /> : null}
          </div>
        </div>

        <div className="chatComposerDock">
          {phase === "idle" ? (
            <div className="chatSuggestions" aria-label="Suggested prompts">
              <div className="chatSuggestionsLabel">Try a suggested prompt:</div>
              <div className="chatSuggestionsRow">
                {suggestedPrompts.map((p) => (
                  <button
                    key={p.slice(0, 32)}
                    type="button"
                    className="suggestionChip"
                    onClick={() => applySuggestedPrompt(p)}
                    disabled={isBusy}
                    title="Click to use & edit"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <PromptInput
            value={composerText}
            onChange={setComposerText}
            onSend={send}
            disabled={isBusy}
            placeholder={placeholder}
            hint="Enter to send • Shift+Enter for newline"
          />
        </div>
      </div>
    </ChatContainer>
  );
}
