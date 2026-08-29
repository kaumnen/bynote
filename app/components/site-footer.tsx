import { WebMcpStatus } from "./webmcp-status";
import type { WebMcpStatus as Status } from "../hooks/use-webmcp";

export function SiteFooter({
  status,
  toolCount,
  prompt,
}: {
  status: Status;
  toolCount: number;
  prompt: string;
}) {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <WebMcpStatus status={status} toolCount={toolCount} prompt={prompt} />
        <p className="site-footer-credit">
          Made by{" "}
          <a href="https://x.com/kaumnen" target="_blank" rel="noreferrer">
            kaumnen
          </a>
        </p>
      </div>
    </footer>
  );
}
