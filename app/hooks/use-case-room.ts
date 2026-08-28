import { useCallback, useEffect, useRef, useState } from "react";

import {
  CaseStateSchema,
  type CaseAction,
  type CaseState,
} from "../../src/shared/schemas";
import {
  caseSocketUrl,
  fetchCase,
  sendCaseAction,
} from "../lib/case-client";

export type ConnectionStatus = "connecting" | "live" | "offline";

export function useCaseRoom(initialState: CaseState) {
  const [state, setState] = useState(initialState);
  const [connection, setConnection] =
    useState<ConnectionStatus>("connecting");
  const stateRef = useRef(initialState);

  const updateState = useCallback((next: CaseState) => {
    if (next.revision >= stateRef.current.revision) {
      stateRef.current = next;
      setState(next);
    }
  }, []);

  const submit = useCallback(
    async (action: CaseAction) => {
      const next = await sendCaseAction(initialState.id, action);
      updateState(next);
      return next;
    },
    [initialState.id, updateState],
  );

  const refresh = useCallback(async () => {
    const next = await fetchCase(initialState.id);
    updateState(next);
    return next;
  }, [initialState.id, updateState]);

  const getState = useCallback(() => stateRef.current, []);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      setConnection("connecting");
      socket = new WebSocket(caseSocketUrl(initialState.id));

      socket.addEventListener("open", () => {
        setConnection("live");
      });

      socket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") {
          return;
        }

        try {
          const message: unknown = JSON.parse(event.data);
          if (
            typeof message === "object" &&
            message !== null &&
            "type" in message &&
            message.type === "case.updated" &&
            "state" in message
          ) {
            const parsed = CaseStateSchema.safeParse(message.state);
            if (parsed.success) {
              updateState(parsed.data);
            }
          }
        } catch {
          setConnection("offline");
        }
      });

      socket.addEventListener("close", () => {
        setConnection("offline");
        if (!closed) {
          retry = setTimeout(connect, 1_500);
        }
      });

      socket.addEventListener("error", () => {
        setConnection("offline");
      });
    };

    connect();

    return () => {
      closed = true;
      if (retry) {
        clearTimeout(retry);
      }
      socket?.close(1000, "Page closed");
    };
  }, [initialState.id, updateState]);

  return {
    state,
    connection,
    submit,
    refresh,
    getState,
  };
}
