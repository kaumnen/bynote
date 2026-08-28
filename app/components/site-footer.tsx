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
        <span>LOCAL TO THIS BROWSER / EXPORT TO SHARE</span>
      </div>
    </footer>
  );
}
