import type { ReactNode } from "react";

export function ChatContainer(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="chatApp">
      <header className="chatHeader">
        <div className="chatHeaderInner">
          <div className="chatBrand">
            <div className="chatBrandMark" aria-hidden />
            <div className="chatBrandText">
              <div className="chatTitle">{props.title}</div>
              {props.subtitle ? (
                <div className="chatSubtitle">{props.subtitle}</div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <main className="chatMain">{props.children}</main>
    </div>
  );
}

