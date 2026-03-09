import type { ReactNode } from "react";

export function ChatMessage(props: {
  role: "user" | "assistant";
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className={`chatMsg chatMsg--${props.role}`}>
      <div className="chatMsgBubble">
        <div className="chatMsgContent">{props.children}</div>
        {props.footer ? <div className="chatMsgFooter">{props.footer}</div> : null}
      </div>
    </div>
  );
}

