import { describe, expect, it } from "vitest";

import {
  createFieldCopy,
  defaultSeverityFor,
  kindLabel,
  kindUsesSeverity,
  statusOptions,
} from "./templates";

describe("template kind copy", () => {
  it("keeps severity for incidents and bugs only", () => {
    expect(kindUsesSeverity("incident")).toBe(true);
    expect(kindUsesSeverity("bug")).toBe(true);
    expect(kindUsesSeverity("feature")).toBe(false);
    expect(kindUsesSeverity("custom")).toBe(false);
    expect(defaultSeverityFor("feature")).toBe("medium");
    expect(defaultSeverityFor("incident")).toBe("high");
  });

  it("uses work status language for features and custom notebooks", () => {
    expect(kindLabel("custom")).toBe("Custom");
    expect(statusOptions("incident").map(({ label }) => label)).toContain(
      "Investigating",
    );
    expect(statusOptions("feature").map(({ label }) => label)).toEqual([
      "Open",
      "In progress",
      "Paused",
      "Done",
    ]);
    expect(createFieldCopy("custom").title).toBe("Untitled notebook");
  });
});
