import { useEffect, useState } from "react";

import type { Actor } from "../../src/shared/schemas";

const ACTOR_KEY = "byline.actor";

export function readStoredActorName() {
  if (typeof localStorage === "undefined") {
    return "Guest";
  }

  try {
    const stored = localStorage.getItem(ACTOR_KEY);
    if (!stored) {
      return "Guest";
    }
    const value = JSON.parse(stored) as Partial<Actor>;
    const name = typeof value.name === "string" ? value.name.trim() : "";
    if (!name) {
      return "Guest";
    }
    return (name === "Mina" ? "Alex" : name).slice(0, 48);
  } catch {
    return "Guest";
  }
}

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
          const name =
            value.name.trim() === "Mina" ? "Alex" : value.name.trim();
          const currentActor = { id: value.id, name, kind: "human" as const };
          if (name !== value.name.trim()) {
            window.localStorage.setItem(
              ACTOR_KEY,
              JSON.stringify(currentActor),
            );
          }
          setCurrent(currentActor);
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
