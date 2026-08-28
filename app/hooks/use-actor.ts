import { useEffect, useState } from "react";

import type { Actor } from "../../src/shared/schemas";

const ACTOR_KEY = "byline.actor";

const initialActor: Actor = {
  id: "pending",
  name: "Guest",
  kind: "human",
};

export function useActor() {
  const [current, setCurrent] = useState<Actor>(initialActor);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ACTOR_KEY);
      if (stored) {
        const value = JSON.parse(stored) as Partial<Actor>;
        if (
          typeof value.id === "string" &&
          typeof value.name === "string" &&
          value.name.trim()
        ) {
          setCurrent({ id: value.id, name: value.name, kind: "human" });
          return;
        }
      }

      const created: Actor = {
        id: crypto.randomUUID(),
        name: "Guest",
        kind: "human",
      };
      window.localStorage.setItem(ACTOR_KEY, JSON.stringify(created));
      setCurrent(created);
    } catch {
      setCurrent({
        id: crypto.randomUUID(),
        name: "Guest",
        kind: "human",
      });
    }
  }, []);

  const setName = (name: string) => {
    const next = {
      ...current,
      name: name.trim().slice(0, 48) || "Guest",
    };
    setCurrent(next);
    try {
      window.localStorage.setItem(ACTOR_KEY, JSON.stringify(next));
    } catch {
      return;
    }
  };

  return { actor: current, setName };
}
