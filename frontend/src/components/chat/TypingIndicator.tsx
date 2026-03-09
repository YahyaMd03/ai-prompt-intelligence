export function TypingIndicator(props: { text?: string | null }) {
  return (
    <div className="typingRow" aria-live="polite" aria-label="Assistant typing">
      <div className="typingBubble">
        <span className="typingDots" aria-hidden>
          <span className="typingDot" />
          <span className="typingDot" />
          <span className="typingDot" />
        </span>
        {props.text ? <span className="typingText">{props.text}</span> : null}
      </div>
    </div>
  );
}

