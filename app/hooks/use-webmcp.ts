import { useEffect, useRef, useState } from "react";

import type { ModelContext } from "../webmcp/types";
import "../webmcp/types";

export type WebMcpStatus = "checking" | "ready" | "unavailable" | "error";

export type WebMcpRegistration = {
  ready: Promise<unknown>;
  toolNames: string[];
  dispose: () => void;
};

export function useWebMcp(
  register: (modelContext: ModelContext) => WebMcpRegistration,
  enabled = true,
  extraDeps: unknown[] = [],
) {
  const [status, setStatus] = useState<WebMcpStatus>("checking");
  const [toolCount, setToolCount] = useState(0);
  const registerRef = useRef(register);
  registerRef.current = register;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!document.modelContext) {
      setStatus("unavailable");
      setToolCount(0);
      return;
    }

    setStatus("checking");
    const registration = registerRef.current(document.modelContext);
    setToolCount(registration.toolNames.length);

    registration.ready.then(
      () => setStatus("ready"),
      () => setStatus("error"),
    );

    return registration.dispose;
    // extraDeps lets callers re-register when closed-over identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...extraDeps]);

  return { status, toolCount };
}
