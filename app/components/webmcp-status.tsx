import { useId, useState } from "react";

import type { WebMcpStatus as Status } from "../hooks/use-webmcp";

export function WebMcpStatus({
  status,
  toolCount,
  prompt,
}: {
  status: Status;
  toolCount: number;
  prompt: string;
}) {
  const [copied, setCopied] = useState(false);
  const promptPreviewId = useId();

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      return;
    }
  };

  const label =
    status === "ready"
      ? `WebMCP · ${toolCount} ${toolCount === 1 ? "tool" : "tools"}`
      : status === "unavailable"
        ? "WebMCP off"
        : status === "error"
          ? "WebMCP blocked"
          : "WebMCP";

  return (
    <div className={`webmcp-status webmcp-status-${status}`}>
      <span className="webmcp-pill">
        <i className="webmcp-dot" aria-hidden="true" />
        <span>{label}</span>
      </span>
      <div className="webmcp-prompt">
        <button
          className="button-quiet"
          type="button"
          aria-describedby={promptPreviewId}
          onClick={() => void copyPrompt()}
        >
          {copied ? "Copied" : "Copy prompt"}
        </button>
        <div
          className="webmcp-prompt-preview"
          id={promptPreviewId}
          role="tooltip"
        >
          <div className="webmcp-prompt-preview-screen">
            <span>Agent prompt</span>
            <pre>{prompt}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
