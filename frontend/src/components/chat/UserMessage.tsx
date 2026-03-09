import type { ReactNode } from "react";

import { ChatMessage } from "./ChatMessage";

export function UserMessage(props: { children: ReactNode; footer?: ReactNode }) {
  return (
    <ChatMessage role="user" footer={props.footer}>
      {props.children}
    </ChatMessage>
  );
}

