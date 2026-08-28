import { describe, expect, it } from "vitest";

import { isNotebookId, newNotebookId } from "./case-id";

describe("notebook ids", () => {
  it("uses 32 hex characters", () => {
    expect(newNotebookId()).toMatch(/^[a-f0-9]{32}$/);
    expect(isNotebookId(newNotebookId())).toBe(true);
    expect(isNotebookId("not-an-id")).toBe(false);
  });
});
