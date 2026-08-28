import { useEffect, useState } from "react";

import type {
  Actor,
  CaseAction,
  CaseState,
} from "../../src/shared/schemas";
import { registerCaseTools } from "../webmcp/register-tools";
import "../webmcp/types";

export type WebMcpStatus =
  | "checking"
  | "ready"
  | "unavailable"
  | "error";

type UseWebMcpOptions = {
  actor: Actor;
  getState: () => CaseState;
  submit: (action: CaseAction) => Promise<CaseState>;
};

export function useWebMcp({
  actor,
  getState,
  submit,
}: UseWebMcpOptions) {
  const [status, setStatus] = useState<WebMcpStatus>("checking");

  useEffect(() => {
    if (actor.id === "pending") {
      return;
    }

    if (!document.modelContext) {
      setStatus("unavailable");
      return;
    }

    setStatus("checking");
    const registration = registerCaseTools({
      modelContext: document.modelContext,
      baseActor: actor,
      getState,
      submit,
      storage: window.sessionStorage,
    });

    registration.ready.then(
      () => setStatus("ready"),
      () => setStatus("error"),
    );

    return registration.dispose;
  }, [actor.id, actor.name, getState, submit]);

  return status;
}
