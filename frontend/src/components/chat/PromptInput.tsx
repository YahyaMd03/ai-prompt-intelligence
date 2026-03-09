import { useCallback, useMemo } from "react";

export function PromptInput(props: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const sendDisabled = useMemo(() => props.disabled || !props.value.trim(), [props.disabled, props.value]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Enter") return;
      if (e.shiftKey) return;
      e.preventDefault();
      if (!sendDisabled) props.onSend();
    },
    [props, sendDisabled],
  );

  return (
    <div className="chatComposer">
      <div className="chatComposerInner">
        <textarea
          className="chatComposerInput"
          aria-label="Message input"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={props.placeholder ?? "Message…"}
          rows={1}
          disabled={props.disabled}
        />
        <button
          type="button"
          className="chatSendBtn"
          onClick={props.onSend}
          disabled={sendDisabled}
          aria-label="Send message"
        >
          Send
        </button>
      </div>
      {props.hint ? <div className="chatComposerHint">{props.hint}</div> : null}
    </div>
  );
}

