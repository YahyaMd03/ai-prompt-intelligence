import type { ReactNode } from "react";

import { ChatMessage } from "./ChatMessage";

export function AssistantMessage(props: { children: ReactNode; footer?: ReactNode }) {
  return (
    <ChatMessage role="assistant" footer={props.footer}>
      {props.children}
    </ChatMessage>
  );
}

