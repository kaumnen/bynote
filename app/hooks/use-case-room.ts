import { useCallback, useEffect, useRef, useState } from "react";

import { applyCaseAction } from "../../src/shared/case-state";
import {
  CaseStateSchema,
  type CaseAction,
  type CaseState,
} from "../../src/shared/schemas";
import { writeLocalNotebook } from "../lib/local-notebook";

export function useCaseRoom(initialState: CaseState) {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(initialState);

  const updateState = useCallback((next: CaseState) => {
    if (next.revision >= stateRef.current.revision) {
      stateRef.current = next;
      setState(next);
    }
  }, []);

  const submit = useCallback(async (action: CaseAction) => {
    const next = applyCaseAction(stateRef.current, action);
    writeLocalNotebook(next);
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(`bynote:${initialState.id}`);
      channel.postMessage(next);
      channel.close();
    }
    updateState(next);
    return next;
  }, [initialState.id, updateState]);

  const getState = useCallback(() => stateRef.current, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(`bynote:${initialState.id}`);
    channel.addEventListener("message", (event) => {
      const parsed = CaseStateSchema.safeParse(event.data);
      if (parsed.success) {
        updateState(parsed.data);
      }
    });

    return () => channel.close();
  }, [initialState.id, updateState]);

  return {
    state,
    submit,
    getState,
  };
}
