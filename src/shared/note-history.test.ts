import { describe, expect, it } from "vitest";

import { NOTE_REVISION_MAX } from "./schemas";
import { lineDiff, reviseNoteItem, splitDiffRows } from "./note-history";
import type { Actor, NoteItem } from "./schemas";

const alex: Actor = { id: "human-1", name: "Alex", kind: "human" };
const mira: Actor = { id: "agent-1", name: "Mira", kind: "agent" };

function note(body: string): NoteItem {
  return {
    id: "note-1",
    sectionId: "section-1",
    body,
    author: alex,
    source: "human-ui",
    createdAt: "2026-08-28T12:00:00.000Z",
  };
}

describe("reviseNoteItem", () => {
  it("keeps the same note and records who updated it", () => {
    const original = note("Goal: ship the one-pager.");
    const revised = reviseNoteItem(
      original,
      "Goal: ship the one-pager after legal.",
      mira,
      "webmcp",
      "2026-08-28T12:15:00.000Z",
    );

    expect(revised.id).toBe(original.id);
    expect(revised.author).toEqual(alex);
    expect(revised.body).toContain("legal");
    expect(revised.updatedBy).toEqual(mira);
    expect(revised.revisions).toHaveLength(2);
    expect(revised.revisions?.[0]?.body).toBe(original.body);
    expect(revised.revisions?.at(-1)?.author).toEqual(mira);
  });

  it("returns the same object when the body did not change", () => {
    const original = note("Unchanged");
    expect(
      reviseNoteItem(original, "Unchanged", mira, "webmcp", "2026-08-28T12:15:00.000Z"),
    ).toBe(original);
  });

  it("keeps the original snapshot when history is capped", () => {
    let current = note("v0");
    for (let index = 1; index <= NOTE_REVISION_MAX + 2; index += 1) {
      current = reviseNoteItem(
        current,
        `v${index}`,
        mira,
        "webmcp",
        `2026-08-28T12:${String(index).padStart(2, "0")}:00.000Z`,
      );
    }

    expect(current.revisions).toHaveLength(NOTE_REVISION_MAX);
    expect(current.revisions?.[0]?.body).toBe("v0");
    expect(current.body).toBe(`v${NOTE_REVISION_MAX + 2}`);
    expect(current.revisions?.at(-1)?.body).toBe(current.body);
  });
});

describe("lineDiff", () => {
  it("marks a checkbox flip as one changed line", () => {
    const diff = lineDiff("- [ ] Open\n- [x] Done", "- [x] Open\n- [x] Done");
    expect(diff).toEqual([
      { kind: "del", text: "- [ ] Open" },
      { kind: "add", text: "- [x] Open" },
      { kind: "same", text: "- [x] Done" },
    ]);
  });

  it("pairs a replaced line for a side-by-side view", () => {
    expect(splitDiffRows("- [ ] Open\nkeep", "- [x] Open\nkeep")).toEqual([
      {
        left: { kind: "del", text: "- [ ] Open" },
        right: { kind: "add", text: "- [x] Open" },
      },
      {
        left: { kind: "same", text: "keep" },
        right: { kind: "same", text: "keep" },
      },
    ]);
  });
});
