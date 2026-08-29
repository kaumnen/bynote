import { useEffect, useState } from "react";

import type { Actor } from "../../src/shared/schemas";

const ACTOR_KEY = "bynote.actor";
const LEGACY_ACTOR_KEY = "byline.actor";

function readActorRecord() {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const current = localStorage.getItem(ACTOR_KEY);
  if (current) {
    return current;
  }

  const legacy = localStorage.getItem(LEGACY_ACTOR_KEY);
  if (!legacy) {
    return null;
  }

  localStorage.setItem(ACTOR_KEY, legacy);
  localStorage.removeItem(LEGACY_ACTOR_KEY);
  return legacy;
}

export function readStoredActorName() {
  if (typeof localStorage === "undefined") {
    return "Guest";
  }

  try {
    const stored = readActorRecord();
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
      const stored = readActorRecord();
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
            window.localStorage.removeItem(LEGACY_ACTOR_KEY);
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
      window.localStorage.removeItem(LEGACY_ACTOR_KEY);
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
      window.localStorage.removeItem(LEGACY_ACTOR_KEY);
    } catch {
      return;
    }
  };

  return { actor: current, setName };
}
